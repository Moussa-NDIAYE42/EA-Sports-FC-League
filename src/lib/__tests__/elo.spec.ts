import { describe, it, expect } from 'vitest'
import { computeEloChange, expectedScore, teamFactor, marginFactor } from '../elo'

describe('expectedScore', () => {
  it('renvoie 0.5 pour deux ELO identiques', () => {
    expect(expectedScore(1500, 1500)).toBeCloseTo(0.5, 5)
  })
  it('favorise le joueur le mieux classé', () => {
    expect(expectedScore(1700, 1500)).toBeGreaterThan(0.5)
  })
})

describe('teamFactor', () => {
  it('est neutre (1) si une note manque', () => {
    expect(teamFactor(null, 90)).toBe(1)
    expect(teamFactor(85, null)).toBe(1)
  })
  it('avantage celui qui a la note la plus faible face à un adversaire mieux noté', () => {
    // moi 85, adversaire 90 → adversaire meilleur → facteur > 1 pour moi
    expect(teamFactor(85, 90)).toBeGreaterThan(1)
    // l'inverse est vrai pour l'adversaire
    expect(teamFactor(90, 85)).toBeLessThan(1)
  })
  it('est borné (clamp) même pour un écart extrême', () => {
    expect(teamFactor(50, 99)).toBeLessThanOrEqual(1.3)
    expect(teamFactor(99, 50)).toBeGreaterThanOrEqual(0.7)
  })
})

describe('marginFactor', () => {
  it('vaut 1 pour un match nul', () => {
    expect(marginFactor(1, 1)).toBe(1)
  })
  it('croît avec la marge mais avec un rendement décroissant', () => {
    const m1 = marginFactor(1, 0)
    const m2 = marginFactor(2, 0)
    const m6 = marginFactor(6, 0)
    const m7 = marginFactor(7, 0)
    expect(m2).toBeGreaterThan(m1)
    expect(m6).toBeGreaterThan(m2)
    // le gain marginal entre 6 et 7 doit être plus petit qu'entre 1 et 2 (log)
    expect(m7 - m6).toBeLessThan(m2 - m1)
  })
  it('est plafonné au-delà de margin_cap (8 par défaut)', () => {
    expect(marginFactor(8, 0)).toBe(marginFactor(15, 0))
  })
})

describe('computeEloChange — scénarios du cahier des charges', () => {
  it('Match A : outsider (ELO+équipe plus faibles) qui gagne progresse fortement', () => {
    // Joueur A : ELO 1500, équipe 85 — bat Joueur B : ELO 1700, équipe 90, score 3-1
    const resultA = computeEloChange({
      myElo: 1500,
      opponentElo: 1700,
      myGamesPlayed: 50,
      myTeamRating: 85,
      opponentTeamRating: 90,
      myGoals: 3,
      opponentGoals: 1,
    })
    expect(resultA.actual).toBe(1)
    expect(resultA.teamFactor).toBeGreaterThan(1) // équipe plus faible que l'adversaire
    expect(resultA.marginFactor).toBeGreaterThan(1) // marge de 2 buts
    expect(resultA.finalChange).toBeGreaterThan(18) // nettement plus que le K de base (20 × 0.76 ≈ 15 sans les facteurs)
  })

  it('Match B : favori écrasant qui gagne "logiquement" progresse peu', () => {
    // Joueur A : ELO 1700, équipe 92 — bat Joueur B : ELO 1300, équipe 82, score 1-0
    const resultB = computeEloChange({
      myElo: 1700,
      opponentElo: 1300,
      myGamesPlayed: 50,
      myTeamRating: 92,
      opponentTeamRating: 82,
      myGoals: 1,
      opponentGoals: 0,
    })
    expect(resultB.actual).toBe(1)
    expect(resultB.teamFactor).toBeLessThan(1) // équipe largement supérieure
    expect(resultB.finalChange).toBeGreaterThan(0) // une victoire reste toujours positive
    expect(resultB.finalChange).toBeLessThan(15) // mais faible progression
  })

  it('Match A rapporte strictement plus que Match B (performance mieux valorisée)', () => {
    const a = computeEloChange({ myElo: 1500, opponentElo: 1700, myGamesPlayed: 50, myTeamRating: 85, opponentTeamRating: 90, myGoals: 3, opponentGoals: 1 })
    const b = computeEloChange({ myElo: 1700, opponentElo: 1300, myGamesPlayed: 50, myTeamRating: 92, opponentTeamRating: 82, myGoals: 1, opponentGoals: 0 })
    expect(a.finalChange).toBeGreaterThan(b.finalChange)
  })

  it('une défaite fait toujours perdre des points, jamais en gagner', () => {
    const result = computeEloChange({
      myElo: 1300, opponentElo: 1700, myGamesPlayed: 50,
      myTeamRating: 99, opponentTeamRating: 50, // équipe très forte mais perd quand même
      myGoals: 0, opponentGoals: 1,
    })
    expect(result.finalChange).toBeLessThan(0)
  })

  it('respecte le plancher min_change (une victoire "attendue" rapporte au moins 3 points)', () => {
    const result = computeEloChange({
      myElo: 1900, opponentElo: 1000, myGamesPlayed: 50,
      myTeamRating: 90, opponentTeamRating: 90, myGoals: 1, opponentGoals: 0,
    })
    expect(result.finalChange).toBeGreaterThanOrEqual(3)
  })

  it('respecte le plafond max_change même pour un score extrême', () => {
    const result = computeEloChange({
      myElo: 1000, opponentElo: 2000, myGamesPlayed: 50,
      myTeamRating: 50, opponentTeamRating: 99, myGoals: 20, opponentGoals: 0,
    })
    expect(result.finalChange).toBeLessThanOrEqual(50)
  })

  it('un joueur en calibrage (<10 matchs) a un K plus élevé', () => {
    const provisional = computeEloChange({ myElo: 1000, opponentElo: 1000, myGamesPlayed: 3, myTeamRating: null, opponentTeamRating: null, myGoals: 1, opponentGoals: 0 })
    const established = computeEloChange({ myElo: 1000, opponentElo: 1000, myGamesPlayed: 30, myTeamRating: null, opponentTeamRating: null, myGoals: 1, opponentGoals: 0 })
    expect(provisional.k).toBeGreaterThan(established.k)
    expect(provisional.finalChange).toBeGreaterThan(established.finalChange)
  })
})
