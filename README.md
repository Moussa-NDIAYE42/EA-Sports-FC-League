# FC26 ELO League

Application privée de classement ELO pour un groupe fermé de 20 joueurs maximum.
Stack : React + TypeScript + Vite + Tailwind + Supabase (Postgres + Auth).

## Ce qui est réellement implémenté

- Authentification par email/mot de passe (Supabase Auth)
- Inscription **uniquement** par code d'invitation, avec limite stricte de 20 membres
- **Classement ELO Performance** : au-delà du résultat brut, le calcul prend en compte le niveau de l'adversaire, la note d'équipe EA FC de chaque joueur et la marge de victoire (rendement décroissant). Voir [`docs/ELO_SYSTEM.md`](docs/ELO_SYSTEM.md) pour la formule complète et `src/lib/__tests__/elo.spec.ts` pour les tests de non-régression.
- Départage du classement : ELO → différence de buts → victoires → buts marqués
- Statistiques complètes par joueur : matchs joués, V/N/D, buts marqués/encaissés, différence de buts, forme récente (5 derniers matchs)
- Système de rangs cosmétiques Bronze → Silver → Gold → Elite → Champion → Legend, avec cartes de joueur dédiées
- Photo de profil personnalisable (upload vers Supabase Storage, formats PNG/JPEG/WebP, 2 Mo max)
- Podium spectaculaire, aperçu en direct de la variation ELO avant d'enregistrer un match
- Enregistrement de match → **en attente de confirmation par l'adversaire**
- Calcul de l'ELO **côté serveur** (trigger Postgres `apply_match_elo`), jamais confié au frontend ; détail du calcul consultable dans l'historique
- Confrontations directes (head-to-head) sur le profil d'un autre joueur
- Interface admin : gestion des joueurs, génération de codes, annulation de matchs, **configuration des poids de la formule ELO**
- États de chargement (skeletons), toasts de confirmation, modales de confirmation pour les actions destructrices

## Ce qui N'EST PAS implémenté (structure DB prête, UI à construire)

- **Saisons** (table `seasons` prête) — pas de UI de création/clôture de saison, pas de classement par saison
- **Achievements / badges** (table `achievements` prête) — aucun badge n'est attribué automatiquement
- **Notifications** — non implémentées (nécessiterait Supabase Realtime ou un service push)
- **Récupération de mot de passe / changement de mot de passe** — gérable via les écrans par défaut de Supabase Auth, pas encore intégré dans l'UI custom

Ce sont les prochaines étapes logiques une fois cette version validée par ton groupe.

---

## Installation

### 1. Prérequis
- Node.js 18+
- Un compte Supabase gratuit (supabase.com)

### 2. Créer le projet Supabase

1. Crée un nouveau projet sur [supabase.com](https://supabase.com).
2. Va dans **SQL Editor**, exécute dans l'ordre (chaque fichier est idempotent-safe mais doit être joué dans l'ordre, une seule fois) :
   - `supabase/migrations/001_init.sql`
   - `supabase/migrations/002_fix_invite_on_signup.sql` (corrige le flux d'inscription pour qu'il fonctionne même avec la confirmation email activée)
   - `supabase/migrations/003_match_stats_and_avatars.sql` (statistiques complètes + bucket Storage `avatars`)
   - `supabase/migrations/004_elo_performance.sql` (formule ELO Performance + config admin)
3. Toujours dans le SQL Editor, crée ton premier code d'invitation :
   ```sql
   insert into public.invite_codes (code) values ('COUSINS-2026');
   ```
4. Récupère `Project URL` et `anon public key` dans **Project Settings > API**.
5. Vérifie dans **Authentication > URL Configuration** que "Site URL" correspond bien à l'adresse où tourne ton app (`http://localhost:5173` en dev, ton URL Vercel/Netlify en prod) — sinon le lien de confirmation par email redirige vers la mauvaise adresse.

### 3. Configurer le frontend

```bash
git clone <ce-repo>
cd fc26-elo-league
npm install
cp .env.example .env.local
# édite .env.local avec ton URL et ta clé Supabase
npm run dev
```

### 4. Créer ton compte admin

1. Ouvre l'app, clique "J'ai un code", utilise le code `COUSINS-2026` créé plus haut.
2. Une fois ton profil créé, retourne dans le SQL Editor de Supabase :
   ```sql
   update public.profiles set role = 'admin' where username = 'TON_PSEUDO';
   ```
3. Recharge l'app — l'onglet "Admin" apparaît dans l'en-tête.
4. Depuis l'onglet Admin > Invitations, génère un code pour chaque cousin.

### 5. Déployer

Le frontend est un site statique classique : déployable sur **Vercel** ou **Netlify** en connectant le repo GitHub (n'oublie pas d'ajouter les variables d'environnement `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` dans les réglages du projet).

---

## Notes de sécurité

- La colonne `elo_rating` n'est **jamais** modifiable directement par un membre (RLS + privilèges de colonne) — seul le trigger serveur ou un admin peut l'écrire.
- Un match ne devient "confirmé" (et ne modifie l'ELO) qu'après action de l'**adversaire**, pas du créateur du match — ça empêche un joueur de valider seul un résultat en sa faveur.
- La limite de 20 membres est vérifiée dans la fonction Postgres `claim_invite()`, pas seulement côté frontend.
- Chaque code d'invitation est à usage unique (verrouillage `for update` pour éviter une double utilisation simultanée).
