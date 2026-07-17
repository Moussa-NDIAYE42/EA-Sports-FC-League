/**
 * Système de rangs cosmétiques basé sur le score ELO.
 * Purement visuel : n'affecte jamais le calcul ELO ni le classement,
 * qui restent basés sur les valeurs numériques réelles.
 *
 * Seuils pensés pour une ligue de ~20 joueurs partant tous à 1000 :
 * la majorité du groupe doit se répartir entre Silver et Gold, avec
 * Bronze et Legend comme extrémités rares (le sommet à atteindre).
 */

export type RankId = 'bronze' | 'silver' | 'gold' | 'elite' | 'champion' | 'legend'

export interface RankDef {
  id: RankId
  label: string
  min: number
  max: number | null
  colorClass: string // texte
  bgClass: string // fond doux
  borderClass: string
  cardBgClass: string // fond dégradé pour les cartes joueur premium
}

export const RANKS: RankDef[] = [
  { id: 'bronze', label: 'Bronze', min: 0, max: 949, colorClass: 'text-rank-bronze', bgClass: 'bg-rank-bronze/10', borderClass: 'border-rank-bronze/30', cardBgClass: 'bg-card-bronze' },
  { id: 'silver', label: 'Silver', min: 950, max: 1099, colorClass: 'text-rank-silver', bgClass: 'bg-rank-silver/10', borderClass: 'border-rank-silver/30', cardBgClass: 'bg-card-silver' },
  { id: 'gold', label: 'Gold', min: 1100, max: 1249, colorClass: 'text-rank-gold', bgClass: 'bg-rank-gold/10', borderClass: 'border-rank-gold/30', cardBgClass: 'bg-card-gold' },
  { id: 'elite', label: 'Elite', min: 1250, max: 1399, colorClass: 'text-rank-elite', bgClass: 'bg-rank-elite/10', borderClass: 'border-rank-elite/30', cardBgClass: 'bg-card-elite' },
  { id: 'champion', label: 'Champion', min: 1400, max: 1549, colorClass: 'text-rank-champion', bgClass: 'bg-rank-champion/10', borderClass: 'border-rank-champion/30', cardBgClass: 'bg-card-champion' },
  { id: 'legend', label: 'Legend', min: 1550, max: null, colorClass: 'text-rank-legend', bgClass: 'bg-rank-legend/10', borderClass: 'border-rank-legend/30', cardBgClass: 'bg-card-legend' },
]

export function getRank(elo: number): RankDef {
  return RANKS.find((r) => elo >= r.min && (r.max === null || elo <= r.max)) ?? RANKS[0]
}

/** Progression (0-1) vers le rang suivant, pour une barre de progression. */
export function rankProgress(elo: number): { rank: RankDef; next: RankDef | null; progress: number } {
  const rank = getRank(elo)
  const idx = RANKS.findIndex((r) => r.id === rank.id)
  const next = RANKS[idx + 1] ?? null
  if (!next || rank.max === null) return { rank, next: null, progress: 1 }
  const span = rank.max - rank.min + 1
  const progress = Math.min(1, Math.max(0, (elo - rank.min) / span))
  return { rank, next, progress }
}
