-- ============================================================
-- Migration 004 : ELO Performance (facteur équipe + marge de victoire)
-- À exécuter APRÈS 003_match_stats_and_avatars.sql
-- Voir docs/ELO_SYSTEM.md pour le détail de la formule.
-- ============================================================

-- ---------- 1. Config admin (ligne unique) ----------
create table if not exists public.league_config (
  id boolean primary key default true check (id),
  k_provisional integer not null default 40,
  k_established integer not null default 20,
  provisional_threshold integer not null default 10,
  weight_team numeric not null default 0.3,
  weight_margin numeric not null default 0.15,
  margin_cap integer not null default 8,
  max_change integer not null default 50,
  min_change integer not null default 3,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);
insert into public.league_config (id) values (true) on conflict (id) do nothing;

alter table public.league_config enable row level security;
create policy "league_config_read_all" on public.league_config for select using (true);
create policy "league_config_admin_write" on public.league_config for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- ---------- 2. Notes d'équipe + détail de calcul sur matches ----------
alter table public.matches
  add column if not exists team1_rating smallint check (team1_rating between 1 and 99),
  add column if not exists team2_rating smallint check (team2_rating between 1 and 99),
  add column if not exists calculation_detail jsonb;

-- ---------- 3. Trigger apply_match_elo() — v2 (ELO Performance) ----------
create or replace function public.apply_match_elo()
returns trigger language plpgsql security definer as $$
declare
  p1 public.profiles;
  p2 public.profiles;
  cfg public.league_config;
  games1 integer;
  games2 integer;
  k1 integer;
  k2 integer;
  expected1 numeric;
  expected2 numeric;
  actual1 numeric;
  actual2 numeric;
  team_diff1 numeric;
  team_diff2 numeric;
  team_factor1 numeric;
  team_factor2 numeric;
  margin integer;
  margin_factor numeric;
  raw1 numeric;
  raw2 numeric;
  change1 integer;
  change2 integer;
  new_elo1 integer;
  new_elo2 integer;
  form1 text;
  form2 text;
begin
  if new.status <> 'confirmed' or old.status = 'confirmed' then
    return new;
  end if;

  select * into cfg from public.league_config where id = true;
  select * into p1 from public.profiles where id = new.player1_id for update;
  select * into p2 from public.profiles where id = new.player2_id for update;

  select count(*) into games1 from public.matches
    where status = 'confirmed' and (player1_id = p1.id or player2_id = p1.id);
  select count(*) into games2 from public.matches
    where status = 'confirmed' and (player1_id = p2.id or player2_id = p2.id);

  k1 := case when games1 < cfg.provisional_threshold then cfg.k_provisional else cfg.k_established end;
  k2 := case when games2 < cfg.provisional_threshold then cfg.k_provisional else cfg.k_established end;

  expected1 := 1.0 / (1 + power(10, (p2.elo_rating - p1.elo_rating) / 400.0));
  expected2 := 1.0 / (1 + power(10, (p1.elo_rating - p2.elo_rating) / 400.0));

  if new.player1_score > new.player2_score then
    actual1 := 1; actual2 := 0; new.winner_id := new.player1_id;
    form1 := 'W'; form2 := 'L';
  elsif new.player1_score < new.player2_score then
    actual1 := 0; actual2 := 1; new.winner_id := new.player2_id;
    form1 := 'L'; form2 := 'W';
  else
    actual1 := 0.5; actual2 := 0.5; new.winner_id := null;
    form1 := 'D'; form2 := 'D';
  end if;

  -- Facteur équipe : neutre (1) si une des deux notes est absente.
  if new.team1_rating is not null and new.team2_rating is not null then
    team_diff1 := new.team2_rating - new.team1_rating;
    team_diff2 := -team_diff1;
    team_factor1 := 1 + cfg.weight_team * greatest(-1, least(1, team_diff1 / 20.0));
    team_factor2 := 1 + cfg.weight_team * greatest(-1, least(1, team_diff2 / 20.0));
  else
    team_factor1 := 1;
    team_factor2 := 1;
  end if;

  -- Facteur marge : rendement décroissant, identique pour les deux joueurs.
  margin := abs(new.player1_score - new.player2_score);
  margin_factor := 1 + cfg.weight_margin * ln(1 + least(margin, cfg.margin_cap));

  raw1 := k1 * (actual1 - expected1) * team_factor1 * margin_factor;
  raw2 := k2 * (actual2 - expected2) * team_factor2 * margin_factor;

  -- Bornes : magnitude entre min_change et max_change, signe préservé
  -- (min_change ne s'applique pas à un nul parfaitement équilibré : actual=expected=0.5 → raw≈0).
  change1 := case
    when raw1 = 0 then 0
    when raw1 > 0 then greatest(cfg.min_change, least(cfg.max_change, round(raw1)))
    else -greatest(cfg.min_change, least(cfg.max_change, round(-raw1)))
  end;
  change2 := case
    when raw2 = 0 then 0
    when raw2 > 0 then greatest(cfg.min_change, least(cfg.max_change, round(raw2)))
    else -greatest(cfg.min_change, least(cfg.max_change, round(-raw2)))
  end;

  new_elo1 := p1.elo_rating + change1;
  new_elo2 := p2.elo_rating + change2;

  new.calculation_detail := jsonb_build_object(
    'player1', jsonb_build_object(
      'elo_before', p1.elo_rating, 'elo_after', new_elo1, 'k', k1,
      'expected', round(expected1, 3), 'actual', actual1,
      'team_factor', round(team_factor1, 3), 'margin_factor', round(margin_factor, 3),
      'raw_change', round(raw1, 2), 'final_change', change1
    ),
    'player2', jsonb_build_object(
      'elo_before', p2.elo_rating, 'elo_after', new_elo2, 'k', k2,
      'expected', round(expected2, 3), 'actual', actual2,
      'team_factor', round(team_factor2, 3), 'margin_factor', round(margin_factor, 3),
      'raw_change', round(raw2, 2), 'final_change', change2
    )
  );

  update public.profiles set
    elo_rating = new_elo1,
    highest_elo = greatest(highest_elo, new_elo1),
    matches_played = matches_played + 1,
    wins = wins + case when form1 = 'W' then 1 else 0 end,
    draws = draws + case when form1 = 'D' then 1 else 0 end,
    losses = losses + case when form1 = 'L' then 1 else 0 end,
    goals_for = goals_for + new.player1_score,
    goals_against = goals_against + new.player2_score,
    recent_form = (array_append(recent_form, form1))[
      greatest(array_length(array_append(recent_form, form1), 1) - 4, 1)
      : array_length(array_append(recent_form, form1), 1)
    ]
    where id = p1.id;

  update public.profiles set
    elo_rating = new_elo2,
    highest_elo = greatest(highest_elo, new_elo2),
    matches_played = matches_played + 1,
    wins = wins + case when form2 = 'W' then 1 else 0 end,
    draws = draws + case when form2 = 'D' then 1 else 0 end,
    losses = losses + case when form2 = 'L' then 1 else 0 end,
    goals_for = goals_for + new.player2_score,
    goals_against = goals_against + new.player1_score,
    recent_form = (array_append(recent_form, form2))[
      greatest(array_length(array_append(recent_form, form2), 1) - 4, 1)
      : array_length(array_append(recent_form, form2), 1)
    ]
    where id = p2.id;

  insert into public.elo_history (match_id, user_id, old_rating, rating_change, new_rating)
    values (new.id, p1.id, p1.elo_rating, change1, new_elo1);
  insert into public.elo_history (match_id, user_id, old_rating, rating_change, new_rating)
    values (new.id, p2.id, p2.elo_rating, change2, new_elo2);

  new.confirmed_at := now();
  return new;
end;
$$;
