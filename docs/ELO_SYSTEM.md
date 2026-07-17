# Système ELO Performance — FC26 ELO League

## Principe

Le calcul classique de l'ELO (`K × (résultat réel - résultat attendu)`) reste la
base : il compare déjà les scores ELO des deux joueurs pour déterminer si un
résultat est une surprise ou non. On lui ajoute **deux multiplicateurs**
indépendants qui ajustent l'ampleur de la variation, sans jamais en changer le
sens (une victoire reste toujours positive, une défaite toujours négative).

```
variation = K × (résultat_réel − résultat_attendu) × facteur_équipe × facteur_marge
```

Puis la variation est bornée par `min_change` / `max_change` (configurable admin).

## 1. Score attendu (inchangé)

```
attendu(A) = 1 / (1 + 10^((ELO_B − ELO_A) / 400))
```

## 2. K-Factor

- `K = 40` pour un joueur avec moins de 10 matchs confirmés (phase de calibrage) ;
- `K = 20` ensuite.
- Chaque joueur a son propre K (asymétrique si l'un est encore en calibrage).
- Modifiable dans `league_config` (`k_provisional`, `k_established`, `provisional_threshold`).

## 3. Facteur équipe (niveau de l'équipe utilisée)

À la saisie du match, chaque joueur indique la **note globale de son équipe**
EA FC (1-99, comme dans le jeu). Pour le joueur A :

```
diff_équipe_A = note_équipe_B − note_équipe_A   (positif si l'adversaire a une meilleure équipe)
facteur_équipe_A = 1 + poids_équipe × clamp(diff_équipe_A / 20, -1, 1)
```

Par défaut `poids_équipe = 0.3` → le facteur varie entre **0.7 et 1.3**.

Interprétation : le facteur amplifie ou atténue **toute** la variation (gain
comme perte), pas seulement les victoires :
- jouer avec une équipe plus faible que l'adversaire amplifie le résultat
  (une victoire rapporte plus, une défaite coûte un peu moins puisqu'elle
  était plus probable) ;
- jouer avec une équipe plus forte atténue le résultat (une victoire rapporte
  moins car "normale", une défaite coûte plus car c'est un signal fort de
  contre-performance).

Si un rating d'équipe est manquant (match saisi sans cette info), le facteur
vaut 1 (neutre) — aucune régression pour les données existantes.

## 4. Facteur marge de victoire (rendement décroissant)

```
marge = |buts_A − buts_B|   (0 pour un nul)
facteur_marge = 1 + poids_marge × ln(1 + min(marge, marge_max))
```

Par défaut `poids_marge = 0.15`, `marge_max = 8` (buts au-delà de 8 n'ont plus
d'impact additionnel, pour éviter le farming de gros scores). Le logarithme
garantit un rendement décroissant : passer de 1-0 à 2-0 pèse plus que passer
de 5-0 à 6-0.

| Marge | facteur_marge (poids 0.15) |
|---|---|
| 0 (nul) | 1.00 |
| 1 | 1.10 |
| 2 | 1.16 |
| 3 | 1.21 |
| 6 | 1.29 |
| 8+ (plafond) | 1.32 |

## 5. Bornes de sécurité

- `max_change` (défaut 50) : variation absolue maximale par match.
- `min_change` (défaut 3) : toute victoire rapporte au moins ce montant, toute
  défaite en coûte au moins autant — garantit que même un match "sans
  surprise" fait progresser/reculer le classement de façon perceptible.

## 6. Transparence

Chaque match confirmé stocke un détail de calcul (`matches.calculation_detail`,
JSON) par joueur : ELO avant/après, attendu, K utilisé, facteur équipe,
facteur marge, variation brute, variation finale bornée. Affiché dans
l'admin et sur le détail du match.

## 7. Exemples de vérification (voir `src/lib/__tests__/elo.spec.ts`)

**Match A** — Joueur A (ELO 1500, équipe 85) bat Joueur B (ELO 1700, équipe 90)
3-1 : victoire contre plus fort ELO, équipe plus faible, marge +2 →
`facteur_équipe > 1` et `facteur_marge > 1` → grosse progression.

**Match B** — Joueur A (ELO 1700, équipe 92) bat Joueur B (ELO 1300, équipe 82)
1-0 : victoire "logique", équipe largement supérieure, marge minimale →
`facteur_équipe < 1` → faible progression, plancher `min_change` si besoin.

## Configuration admin

Table `league_config` (ligne unique) : `k_provisional`, `k_established`,
`provisional_threshold`, `weight_team`, `weight_margin`, `margin_cap`,
`max_change`, `min_change`. Modifiable depuis la page Admin ; s'applique à
tous les matchs confirmés **après** la modification (les matchs déjà calculés
ne sont jamais recalculés rétroactivement).
