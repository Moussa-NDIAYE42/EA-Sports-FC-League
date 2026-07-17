/**
 * IMPORTANT : ce fichier sert à PRÉVISUALISER le changement d'ELO dans
 * l'interface avant l'enregistrement d'un match (ex: "tu gagnerais +18"),
 * et à afficher le détail pédagogique d'un calcul déjà effectué.
 *
 * Le calcul QUI COMPTE VRAIMENT est fait côté serveur, dans la fonction
 * Postgres `apply_match_elo()` (voir supabase/migrations/004_elo_performance.sql).
 * Ce fichier DOIT rester une copie fidèle de cette formule — voir
 * docs/ELO_SYSTEM.md pour la spécification, et
 * src/lib/__tests__/elo.spec.ts pour les scénarios de vérification.
 * Le frontend ne doit JAMAIS être la source de vérité pour l'ELO stocké.
 */

export interface LeagueConfig {
  k_provisional: number
  k_established: number
  provisional_threshold: number
  weight_team: number
  weight_margin: number
  margin_cap: number
  max_change: number
  min_change: number
}

export const DEFAULT_CONFIG: LeagueConfig = {
  k_provisional: 40,
  k_established: 20,
  provisional_threshold: 10,
  weight_team: 0.3,
  weight_margin: 0.15,
  margin_cap: 8,
  max_change: 50,
  min_change: 3,
}

export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400))
}

export function kFactor(gamesPlayed: number, cfg: LeagueConfig = DEFAULT_CONFIG): number {
  return gamesPlayed < cfg.provisional_threshold ? cfg.k_provisional : cfg.k_established
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function teamFactor(myTeamRating: number | null, opponentTeamRating: number | null, cfg: LeagueConfig = DEFAULT_CONFIG): number {
  if (myTeamRating == null || opponentTeamRating == null) return 1
  const diff = opponentTeamRating - myTeamRating // positif si l'adversaire a une meilleure équipe
  return 1 + cfg.weight_team * clamp(diff / 20, -1, 1)
}

export function marginFactor(goalsFor: number, goalsAgainst: number, cfg: LeagueConfig = DEFAULT_CONFIG): number {
  const margin = Math.abs(goalsFor - goalsAgainst)
  return 1 + cfg.weight_margin * Math.log(1 + Math.min(margin, cfg.margin_cap))
}

export interface EloCalcInput {
  myElo: number
  opponentElo: number
  myGamesPlayed: number
  myTeamRating: number | null
  opponentTeamRating: number | null
  myGoals: number
  opponentGoals: number
}

export interface EloCalcResult {
  expected: number
  actual: 1 | 0.5 | 0
  k: number
  teamFactor: number
  marginFactor: number
  rawChange: number
  finalChange: number
}

/** Calcule la variation ELO d'UN joueur — appeler deux fois pour un match. */
export function computeEloChange(input: EloCalcInput, cfg: LeagueConfig = DEFAULT_CONFIG): EloCalcResult {
  const expected = expectedScore(input.myElo, input.opponentElo)
  const actual: 1 | 0.5 | 0 = input.myGoals > input.opponentGoals ? 1 : input.myGoals < input.opponentGoals ? 0 : 0.5
  const k = kFactor(input.myGamesPlayed, cfg)
  const tFactor = teamFactor(input.myTeamRating, input.opponentTeamRating, cfg)
  const mFactor = marginFactor(input.myGoals, input.opponentGoals, cfg)

  const raw = k * (actual - expected) * tFactor * mFactor
  let finalChange: number
  if (raw === 0) finalChange = 0
  else if (raw > 0) finalChange = clamp(Math.round(raw), cfg.min_change, cfg.max_change)
  else finalChange = -clamp(Math.round(-raw), cfg.min_change, cfg.max_change)

  return { expected, actual, k, teamFactor: tFactor, marginFactor: mFactor, rawChange: raw, finalChange }
}

/** Ancienne API conservée pour compat (aperçu simple sans équipe/marge). */
export function previewEloChange(
  ratingA: number,
  ratingB: number,
  gamesPlayedA: number,
  actualScoreA: 1 | 0.5 | 0
): number {
  const expected = expectedScore(ratingA, ratingB)
  const k = kFactor(gamesPlayedA)
  return Math.round(k * (actualScoreA - expected))
}
