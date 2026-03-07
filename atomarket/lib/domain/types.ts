export type MarketStatus =
  | "OPEN"
  | "CLOSED"
  | "RESOLVING"
  | "RESOLVED"
  | "INVALID_REFUND";

export type ResolutionType =
  | "URL_SELECTOR"
  | "JSON_PATH"
  | "MANUAL_WITH_BOND";

export type OutcomeType = "YES" | "NO";
export type ChallengeKind = "OPPOSITE_OUTCOME" | "DISAGREE_NOT_RESOLVED";

export type ProposalStatus = "ACTIVE" | "CHALLENGED" | "FINALIZED" | "REJECTED";

export type ResolutionRuleOperator =
  | "equals"
  | "contains"
  | "regex"
  | "lte"
  | "gte";

export interface Market {
  id: string;
  title: string;
  question: string;
  description: string | null;
  category: string | null;
  status: MarketStatus;
  close_time: string;
  resolution_deadline: string;
  resolution_type: ResolutionType;
  resolution_source: string;
  resolution_rule: Record<string, unknown>;
  challenge_window_hours: number;
  proposal_bond_neutrons: number;
  challenge_bond_neutrons: number;
  resolved_outcome: OutcomeType | null;
  resolution_notes: string | null;
  resolved_at: string | null;
  invalid_reason: string | null;
  resolution_attempts: number;
  volume_neutrons: number;
  b: number;
  q_yes: number;
  q_no: number;
  created_by: string;
  creator_username?: string | null;
  creator_display_name?: string | null;
  created_at: string;
}

export interface Position {
  id: string;
  market_id: string;
  market_title?: string;
  market_status?: MarketStatus;
  market_resolved_outcome?: OutcomeType | null;
  market_q_yes?: number;
  market_q_no?: number;
  market_b?: number;
  user_id: string;
  yes_shares: number;
  no_shares: number;
  net_spent_neutrons: number;
  realized_pnl_neutrons: number;
  updated_at: string;
}

export interface Trade {
  id: string;
  market_id: string;
  market_title?: string;
  market_status?: MarketStatus;
  market_resolved_outcome?: OutcomeType | null;
  user_id: string;
  outcome: OutcomeType;
  side: "BUY" | "SELL";
  quantity: number;
  cost_neutrons: number;
  sell_proceeds_neutrons?: number | null;
  price_before: number;
  price_after: number;
  created_at: string;
}

export interface Profile {
  id: string;
  display_name: string | null;
  username?: string | null;
  is_admin: boolean;
  is_active?: boolean;
  deactivated_at?: string | null;
  neutron_balance: number;
  created_at: string;
}

export interface ProbabilityHistoryPoint {
  ts: string;
  yes_probability: number;
}

export interface PublicProfile {
  user_id: string;
  username: string;
  display_name: string | null;
}

export interface LeaderboardEntry {
  username: string;
  display_name: string | null;
  net_gain_neutrons: number;
  total_cost_neutrons: number;
  total_return_neutrons: number;
  accuracy_score: number | null;
  resolved_markets_count: number;
  shares_traded: number;
}

export interface MarketTopHolder {
  user_id: string;
  username: string | null;
  display_name: string | null;
  shares: number;
}

export interface MarketTopPosition {
  user_id: string;
  username: string | null;
  display_name: string | null;
  shares: number;
  current_value_neutrons: number;
  cost_basis_neutrons: number;
  unrealized_pnl_neutrons: number;
  unrealized_pnl_pct: number | null;
}

export interface MarketPublicTrade {
  id: string;
  market_id: string;
  user_id: string;
  username: string | null;
  display_name: string | null;
  outcome: OutcomeType;
  side: "BUY" | "SELL";
  quantity: number;
  cost_neutrons: number;
  sell_proceeds_neutrons?: number | null;
  price_before: number;
  price_after: number;
  created_at: string;
}

export interface ResolutionChallenge {
  id: string;
  proposal_id: string;
  market_id: string;
  challenged_by: string;
  challenge_kind: ChallengeKind;
  challenge_outcome: OutcomeType | null;
  evidence_url: string | null;
  evidence_note: string | null;
  bond_neutrons: number;
  created_at: string;
}

export interface AdminOverviewStats {
  total_users: number;
  active_users_7d: number;
  active_users_30d: number;
  total_markets: number;
  open_markets: number;
  resolving_markets: number;
  resolved_markets: number;
  invalid_markets: number;
  open_disputes: number;
  markets_nearing_deadline: number;
  overdue_unresolved_markets: number;
  total_volume_neutrons: number;
}

export interface AdminMarketRow {
  id: string;
  title: string;
  category: string | null;
  status: MarketStatus;
  created_at: string;
  close_time: string;
  resolution_deadline: string;
  volume_neutrons: number;
  resolution_attempts: number;
  creator_username: string | null;
  creator_display_name: string | null;
  has_active_proposal: boolean;
  has_challenge: boolean;
  proposal_status: ProposalStatus | null;
  challenge_kind: ChallengeKind | null;
  total_count?: number;
}

export interface AdminUserRow {
  user_id: string;
  username: string | null;
  display_name: string | null;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
  neutron_balance: number;
  trades_count: number;
  created_markets_count: number;
  open_positions_count: number;
  last_trade_at: string | null;
  total_count?: number;
}

export interface AdminActionLog {
  id: string;
  market_id: string;
  action_type: "DEFER" | "RESOLVE" | "INVALIDATE";
  note: string | null;
  created_at: string;
  admin_username: string | null;
  admin_display_name: string | null;
  market_title: string | null;
}

export interface AdminDispute {
  id: string;
  market_id: string;
  proposed_outcome: OutcomeType;
  challenge_deadline: string;
  status: ProposalStatus;
  created_at: string;
  challenge_kind: ChallengeKind;
  challenge_outcome: OutcomeType | null;
  challenge_label: string;
}
