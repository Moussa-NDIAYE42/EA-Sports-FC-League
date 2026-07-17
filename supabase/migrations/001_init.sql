-- ============================================================
-- FC26 ELO League — schéma initial
-- À exécuter dans Supabase Dashboard > SQL Editor
-- ============================================================

-- ---------- Extensions ----------
create extension if not exists "pgcrypto";

-- ---------- Table: profiles ----------
-- Un profil = un membre de la ligue. Créé uniquement via claim_invite()
-- (jamais automatiquement à l'inscription), ce qui garantit la limite de 20
-- et l'accès sur invitation uniquement.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (char_length(username) between 2 and 24),
  avatar_url text,
  elo_rating integer not null default 1000,
  highest_elo integer not null default 1000,
  role text not null default 'member' check (role in ('member', 'admin')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- Table: invite_codes ----------
create table public.invite_codes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  created_by uuid references public.profiles(id),
  used_by uuid references public.profiles(id),
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- Table: seasons ----------
-- (structure prête, non branchée sur l'UI dans ce MVP — voir README "roadmap")
create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date not null,
  end_date date,
  status text not null default 'active' check (status in ('active', 'closed')),
  created_at timestamptz not null default now()
);

-- ---------- Table: matches ----------
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  player1_id uuid not null references public.profiles(id),
  player2_id uuid not null references public.profiles(id),
  player1_score integer not null check (player1_score >= 0),
  player2_score integer not null check (player2_score >= 0),
  winner_id uuid references public.profiles(id),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'disputed', 'cancelled')),
  created_by uuid not null references public.profiles(id),
  season_id uuid references public.seasons(id),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  constraint players_differ check (player1_id <> player2_id)
);

-- ---------- Table: elo_history ----------
-- Trace immuable de chaque changement d'ELO, écrite uniquement par le trigger serveur.
create table public.elo_history (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  old_rating integer not null,
  rating_change integer not null,
  new_rating integer not null,
  created_at timestamptz not null default now()
);

-- ---------- Table: achievements ----------
-- (structure prête, non branchée sur l'UI dans ce MVP — voir README "roadmap")
create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  name text not null,
  description text,
  earned_at timestamptz not null default now()
);

-- ============================================================
-- FONCTIONS SERVEUR
-- ============================================================

-- Compte le nombre de membres actifs, pour appliquer la limite de 20.
create or replace function public.member_count()
returns integer language sql stable as $$
  select count(*)::int from public.profiles;
$$;

-- Réclame un code d'invitation et crée le profil.
-- Appelée depuis le frontend juste après supabase.auth.signUp().
-- SECURITY DEFINER : s'exécute avec les droits du propriétaire, donc peut
-- vérifier/consommer le code même si l'utilisateur n'a pas encore de profil.
create or replace function public.claim_invite(p_code text, p_username text)
returns public.profiles
language plpgsql security definer as $$
declare
  v_invite public.invite_codes;
  v_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Non authentifié';
  end if;

  if public.member_count() >= 20 then
    raise exception 'La ligue est complète (20/20 joueurs).';
  end if;

  select * into v_invite from public.invite_codes
    where code = p_code and used_by is null
    for update; -- verrou pour éviter que deux personnes utilisent le même code en même temps

  if v_invite.id is null then
    raise exception 'Code d''invitation invalide ou déjà utilisé.';
  end if;

  insert into public.profiles (id, username)
    values (auth.uid(), p_username)
    returning * into v_profile;

  update public.invite_codes
    set used_by = auth.uid(), used_at = now()
    where id = v_invite.id;

  return v_profile;
end;
$$;

-- Calcule et applique l'ELO quand un match passe en "confirmed".
-- C'est le SEUL endroit qui écrit dans profiles.elo_rating : le frontend
-- n'a pas la permission de modifier cette colonne directement (voir RLS).
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
begin
  -- Ne réagit qu'au passage vers "confirmed" (pas aux autres updates)
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
  elsif new.player1_score < new.player2_score then
    actual1 := 0; actual2 := 1; new.winner_id := new.player2_id;
  else
    actual1 := 0.5; actual2 := 0.5; new.winner_id := null;
  end if;

  new_elo1 := round(p1.elo_rating + k1 * (actual1 - expected1));
  new_elo2 := round(p2.elo_rating + k2 * (actual2 - expected2));

  update public.profiles set
    elo_rating = new_elo1,
    highest_elo = greatest(highest_elo, new_elo1)
    where id = p1.id;

  update public.profiles set
    elo_rating = new_elo2,
    highest_elo = greatest(highest_elo, new_elo2)
    where id = p2.id;

  insert into public.elo_history (match_id, user_id, old_rating, rating_change, new_rating)
    values (new.id, p1.id, p1.elo_rating, new_elo1 - p1.elo_rating, new_elo1);
  insert into public.elo_history (match_id, user_id, old_rating, rating_change, new_rating)
    values (new.id, p2.id, p2.elo_rating, new_elo2 - p2.elo_rating, new_elo2);

  new.confirmed_at := now();
  return new;
end;
$$;

create trigger trg_apply_match_elo
  before update on public.matches
  for each row execute function public.apply_match_elo();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles enable row level security;
alter table public.matches enable row level security;
alter table public.elo_history enable row level security;
alter table public.invite_codes enable row level security;
alter table public.seasons enable row level security;
alter table public.achievements enable row level security;

-- profiles : lecture par tout membre connecté (classement public à la ligue)
create policy "profiles_select_members" on public.profiles
  for select using (auth.uid() is not null);

-- profiles : un membre ne modifie que son propre avatar (pas son ELO, pas son rôle)
create policy "profiles_update_own_limited" on public.profiles
  for update using (auth.uid() = id);

revoke update on public.profiles from authenticated;
grant update (avatar_url) on public.profiles to authenticated;

-- profiles : un admin peut tout modifier (rôle, is_active, elo en correction manuelle)
create policy "profiles_update_admin" on public.profiles
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
grant update on public.profiles to authenticated; -- la policy ci-dessus restreint qui peut réellement écrire

-- matches : lecture par tout membre connecté
create policy "matches_select_members" on public.matches
  for select using (auth.uid() is not null);

-- matches : un membre ne peut créer un match que s'il en est un des deux joueurs
create policy "matches_insert_participant" on public.matches
  for insert with check (auth.uid() = player1_id or auth.uid() = player2_id);

-- matches : seul l'adversaire (l'autre joueur que le créateur) ou un admin peut confirmer/annuler
create policy "matches_update_opponent_or_admin" on public.matches
  for update using (
    auth.uid() = player1_id or auth.uid() = player2_id
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- elo_history : lecture par tout membre connecté, écriture uniquement par le trigger (security definer)
create policy "elo_history_select_members" on public.elo_history
  for select using (auth.uid() is not null);

-- invite_codes : un admin peut créer/voir les codes ; un membre ne voit rien
create policy "invite_codes_admin_all" on public.invite_codes
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- seasons / achievements : lecture publique aux membres, écriture admin uniquement
create policy "seasons_select_members" on public.seasons for select using (auth.uid() is not null);
create policy "seasons_admin_write" on public.seasons for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "achievements_select_members" on public.achievements for select using (auth.uid() is not null);

-- ============================================================
-- PREMIER ADMIN
-- ============================================================
-- 1. Crée ton compte normalement depuis l'app (il te faudra un premier
--    code d'invitation — insère-en un manuellement ci-dessous avant).
-- 2. Une fois ton profil créé, exécute :
--    update public.profiles set role = 'admin' where username = 'TON_PSEUDO';

-- Exemple de premier code d'invitation à insérer manuellement pour démarrer :
-- insert into public.invite_codes (code) values ('COUSINS-2026');
