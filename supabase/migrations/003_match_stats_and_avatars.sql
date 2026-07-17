-- ============================================================
-- Migration 003 : statistiques de match complètes + avatars
-- À exécuter APRÈS 001_init.sql et 002_fix_invite_on_signup.sql
-- ============================================================
-- Contenu :
--   1. Nouvelles colonnes sur profiles : matchs joués, V/N/D, buts
--      marqués/encaissés, différence de buts (générée), forme récente.
--   2. Mise à jour du trigger apply_match_elo() pour maintenir ces
--      colonnes en plus de l'ELO (même déclencheur, même transaction).
--   3. Backfill des joueurs existants à partir des matchs déjà confirmés.
--   4. Bucket Supabase Storage "avatars" + policies.
-- ============================================================

-- ---------- 1. Nouvelles colonnes ----------
alter table public.profiles
  add column if not exists matches_played integer not null default 0,
  add column if not exists wins integer not null default 0,
  add column if not exists draws integer not null default 0,
  add column if not exists losses integer not null default 0,
  add column if not exists goals_for integer not null default 0,
  add column if not exists goals_against integer not null default 0,
  add column if not exists recent_form text[] not null default '{}';

-- Colonne générée : toujours cohérente, jamais désynchronisée.
alter table public.profiles
  add column if not exists goal_difference integer
  generated always as (goals_for - goals_against) stored;

-- ---------- 2. Trigger apply_match_elo() étendu ----------
-- Remplace la fonction 001 : ajoute la mise à jour des stats de match
-- dans la MÊME transaction que le calcul ELO, pour garantir que les deux
-- ne peuvent jamais diverger (soit tout est appliqué, soit rien ne l'est).
create or replace function public.apply_match_elo()
returns trigger language plpgsql security definer as $$
declare
  p1 public.profiles;
  p2 public.profiles;
  games1 integer;
  games2 integer;
  k1 integer;
  k2 integer;
  expected1 numeric;
  expected2 numeric;
  actual1 numeric;
  actual2 numeric;
  new_elo1 integer;
  new_elo2 integer;
  form1 text;
  form2 text;
begin
  if new.status <> 'confirmed' or old.status = 'confirmed' then
    return new;
  end if;

  select * into p1 from public.profiles where id = new.player1_id for update;
  select * into p2 from public.profiles where id = new.player2_id for update;

  select count(*) into games1 from public.matches
    where status = 'confirmed' and (player1_id = p1.id or player2_id = p1.id);
  select count(*) into games2 from public.matches
    where status = 'confirmed' and (player1_id = p2.id or player2_id = p2.id);

  k1 := case when games1 < 10 then 40 else 20 end;
  k2 := case when games2 < 10 then 40 else 20 end;

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

  new_elo1 := round(p1.elo_rating + k1 * (actual1 - expected1));
  new_elo2 := round(p2.elo_rating + k2 * (actual2 - expected2));

  update public.profiles set
    elo_rating = new_elo1,
    highest_elo = greatest(highest_elo, new_elo1),
    matches_played = matches_played + 1,
    wins = wins + case when form1 = 'W' then 1 else 0 end,
    draws = draws + case when form1 = 'D' then 1 else 0 end,
    losses = losses + case when form1 = 'L' then 1 else 0 end,
    goals_for = goals_for + new.player1_score,
    goals_against = goals_against + new.player2_score,
    -- garde les 5 derniers résultats, plus récent en dernier
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
    values (new.id, p1.id, p1.elo_rating, new_elo1 - p1.elo_rating, new_elo1);
  insert into public.elo_history (match_id, user_id, old_rating, rating_change, new_rating)
    values (new.id, p2.id, p2.elo_rating, new_elo2 - p2.elo_rating, new_elo2);

  new.confirmed_at := now();
  return new;
end;
$$;
-- Le trigger trg_apply_match_elo existant pointe déjà sur cette fonction
-- (create or replace la remplace en place, pas besoin de recréer le trigger).

-- ---------- 3. Backfill des joueurs existants ----------
-- Recalcule matches_played / W-N-D / buts / forme à partir des matchs
-- déjà confirmés, pour les profils créés avant cette migration.
-- Idempotent : peut être relancé sans risque (repart de zéro à chaque fois).
with per_player as (
  select
    player1_id as user_id, player1_score as gf, player2_score as ga,
    case when player1_score > player2_score then 'W'
         when player1_score < player2_score then 'L'
         else 'D' end as result,
    created_at
  from public.matches where status = 'confirmed'
  union all
  select
    player2_id as user_id, player2_score as gf, player1_score as ga,
    case when player2_score > player1_score then 'W'
         when player2_score < player1_score then 'L'
         else 'D' end as result,
    created_at
  from public.matches where status = 'confirmed'
),
agg as (
  select
    user_id,
    count(*) as mp,
    count(*) filter (where result = 'W') as w,
    count(*) filter (where result = 'D') as d,
    count(*) filter (where result = 'L') as l,
    sum(gf) as gf,
    sum(ga) as ga
  from per_player
  group by user_id
),
form as (
  select user_id, array_agg(result order by created_at) as ordered
  from per_player
  group by user_id
)
update public.profiles pr set
  matches_played = coalesce(agg.mp, 0),
  wins = coalesce(agg.w, 0),
  draws = coalesce(agg.d, 0),
  losses = coalesce(agg.l, 0),
  goals_for = coalesce(agg.gf, 0),
  goals_against = coalesce(agg.ga, 0),
  recent_form = coalesce(
    (select ordered[greatest(array_length(ordered,1) - 4, 1) : array_length(ordered,1)] from form where form.user_id = pr.id),
    '{}'
  )
from agg
where agg.user_id = pr.id;

-- ---------- 4. Storage : bucket avatars ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];

-- Lecture publique (les avatars s'affichent dans toute l'app, y compris
-- pour comparer des joueurs) — pas de donnée sensible dans une photo de profil.
create policy "avatars_public_read" on storage.objects
  for select using (bucket_id = 'avatars');

-- Un membre ne peut écrire/remplacer/supprimer que dans son propre dossier
-- (chemin attendu : "<user_id>/avatar.<ext>"), vérifié via le nom du fichier.
create policy "avatars_own_folder_insert" on storage.objects
  for insert with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_own_folder_update" on storage.objects
  for update using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_own_folder_delete" on storage.objects
  for delete using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );
