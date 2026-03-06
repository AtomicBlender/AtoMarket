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
