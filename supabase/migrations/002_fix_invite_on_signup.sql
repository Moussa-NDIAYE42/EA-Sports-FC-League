-- ============================================================
-- Correctif : le profil doit être créé dès la création du compte
-- (auth.users), pas après confirmation email — sinon un utilisateur
-- qui doit confirmer son email se retrouve authentifié mais sans profil,
-- et l'app le renvoie en boucle vers /login.
-- À exécuter APRÈS 001_init.sql dans le SQL Editor de Supabase.
-- ============================================================

-- L'ancienne fonction claim_invite() appelée depuis le frontend après
-- signUp() n'est plus utilisée : on la supprime pour éviter toute confusion.
drop function if exists public.claim_invite(text, text);

-- Nouvelle fonction : lit le code d'invitation et le pseudo dans les
-- métadonnées du compte (passées au moment du signUp côté frontend),
-- et crée le profil immédiatement — que l'email soit confirmé ou non.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := new.raw_user_meta_data ->> 'invite_code';
  v_username text := new.raw_user_meta_data ->> 'username';
  v_invite public.invite_codes;
begin
  -- Si pas de code fourni (ex: compte créé autrement), on ne fait rien.
  if v_code is null or v_username is null then
    return new;
  end if;

  if public.member_count() >= 20 then
    raise exception 'La ligue est complète (20/20 joueurs).';
  end if;

  select * into v_invite from public.invite_codes
    where code = v_code and used_by is null
    for update;

  if v_invite.id is null then
    raise exception 'Code d''invitation invalide ou déjà utilisé.';
  end if;

  insert into public.profiles (id, username) values (new.id, v_username);

  update public.invite_codes
    set used_by = new.id, used_at = now()
    where id = v_invite.id;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Rattraper un compte déjà bloqué (créé avec l'ancien flux, sans profil)
-- ============================================================
-- 1. Trouve ton user id :
--    select id, email, email_confirmed_at from auth.users where email = 'TON_EMAIL';
-- 2. Crée le profil manuellement (remplace les valeurs) :
--    insert into public.profiles (id, username) values ('UUID_COPIÉ', 'TonPseudo');
-- 3. Marque le code comme utilisé si tu veux garder trace :
--    update public.invite_codes set used_by = 'UUID_COPIÉ', used_at = now()
--      where code = 'LE_CODE' and used_by is null;
