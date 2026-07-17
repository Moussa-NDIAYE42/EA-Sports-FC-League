export type Role = 'member' | 'admin'
export type MatchStatus = 'pending' | 'confirmed' | 'disputed' | 'cancelled'
export type MatchResult = 'win' | 'loss' | 'draw'

export interface Profile {
  id: string
  username: string
  avatar_url: string | null
  elo_rating: number
  highest_elo: number
  role: Role
  is_active: boolean
  created_at: string
  matches_played: number
  wins: number
  draws: number
  losses: number
  goals_for: number
  goals_against: number
  goal_difference: number
  recent_form: FormResult[]
}

export type FormResult = 'W' | 'D' | 'L'

export interface EloCalcDetail {
  elo_before: number
  elo_after: number
  k: number
  expected: number
  actual: number
  team_factor: number
  margin_factor: number
  raw_change: number
  final_change: number
}

export interface Match {
  id: string
  player1_id: string
  player2_id: string
  player1_score: number
  player2_score: number
  team1_rating: number | null
  team2_rating: number | null
  winner_id: string | null
  status: MatchStatus
  created_by: string
  created_at: string
  confirmed_at: string | null
  calculation_detail: { player1: EloCalcDetail; player2: EloCalcDetail } | null
  // champs joints (jointures côté requête, pas des colonnes réelles)
  player1?: Profile
  player2?: Profile
}

export interface LeagueConfigRow {
  id: true
  k_provisional: number
  k_established: number
  provisional_threshold: number
  weight_team: number
  weight_margin: number
  margin_cap: number
  max_change: number
  min_change: number
  updated_at: string
  updated_by: string | null
}

export interface EloHistoryEntry {
  id: string
  match_id: string
  user_id: string
  old_rating: number
  rating_change: number
  new_rating: number
  created_at: string
}

export interface InviteCode {
  id: string
  code: string
  created_by: string
  used_by: string | null
  used_at: string | null
  created_at: string
}
