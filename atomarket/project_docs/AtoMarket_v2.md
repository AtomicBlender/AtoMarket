# AtoMarket MVP Requirements (AtoMarket.md)

## 1) Purpose and Product Summary
**AtoMarket** is a lightweight, points-based prediction market MVP with a nuclear/energy theme.  
The goal is to ship a demo-ready web app fast, deployable on **Vercel Free**, backed by **Supabase Free** (Postgres + Auth).  
Users can browse markets and trade YES/NO shares using play-money points. Markets resolve with **low administrative overhead** via:
- **Strict market templates** (creator must choose a resolution type)
- **Auto-resolution** for markets tied to queryable sources
- **User-proposed resolution + bond + challenge window** for everything else
- **Admin escalation only for disputed cases**
- **Refund/Invalid fallback** for unresolvable markets

This MVP is explicitly **non-monetary** (no real money, no payouts, no cash-out).

---

## 2) Target Outcomes
- A clean, usable web app that feels like a prediction market.
- Small but complete feature set: create markets, trade, view portfolio, resolve/settle markets.
- Resolution system that minimizes manual moderation while remaining fair and hard to game.
- Safe defaults: no “harm markets,” clear resolution criteria, verifiable sources.
- Easy for an LLM/codegen agent to implement end-to-end.

---

## 3) Hard Constraints
### Deployment and cost
- Must deploy on **Vercel Free**.
- Must use **Supabase Free** (Postgres + Auth).  
- No paid third-party services required for MVP.

### Tech choices
- **Next.js (App Router) + TypeScript**
- **Supabase Auth** (choose simplest supported by starter)
- **Tailwind CSS**
- UI components: **shadcn/ui** preferred (optional)
- No separate backend service. Use:
  - Next.js Server Actions and/or Route Handlers (`app/api/*`)
  - Supabase client/server SDK

### Market model
- **Binary markets only**: YES / NO
- **Play-money points** only
- Pricing via **LMSR** automated market maker (no order book required in MVP)

### Safety / scope
- Must prevent markets that create perverse incentives:
  - No markets about accidents, deaths, sabotage, terrorism, intentional harm, or enabling wrongdoing.
- Focus on benign, verifiable outcomes: milestones, dates, approvals, deliveries, outages, etc.

---

## 4) MVP Scope (In-Scope Features)

### 4.1 Authentication
- Users can sign up / sign in.
- Require login to trade and view portfolio.
- Anonymous browsing of markets is allowed (optional).

### 4.2 Core pages
1. **Landing** (`/`)
   - Short description of AtoMarket
   - CTA to browse markets and sign in
2. **Markets list** (`/markets`)
   - Table/cards of markets with:
     - Title/question
     - Close time
     - Current YES price (probability)
     - Status (Open / Closed / Resolving / Resolved / Invalid)
     - Resolution type badge
   - Filters:
     - Status
     - Category (optional)
     - Search text
3. **Market detail** (`/markets/[id]`)
   - Question/title
   - Category + tags (optional)
   - Close time
   - **Resolution spec panel** (type + source + rule + challenge window)
   - Current price (YES and NO)
   - Trade panel:
     - Buy YES / Buy NO
     - (Optional) Sell YES / Sell NO
     - Quantity input (shares)
     - Shows estimated cost and post-trade price impact
   - **Resolution timeline** (for propose/challenge markets): proposals, challenges, finalization state
4. **Portfolio** (`/portfolio`)
   - Current points balance
   - Positions by market (YES shares, NO shares)
   - Realized P&L for resolved/invalid markets
5. **Admin** (`/admin`)
   - Visible only to admins
   - Create market (restricted)
   - Resolve disputed markets (rare)
   - Mark invalid/refund (rare)

### 4.3 Trading and accounting
- Each user starts with an initial balance: **10,000 points** (configurable constant).
- Trades execute immediately against LMSR pricing.
- Store every trade in the database.
- Maintain positions per user per market.
- Settlement when market finalizes:
  - YES share pays 1 point if outcome YES else 0 (or refund if invalid)
  - NO share pays 1 point if outcome NO else 0 (or refund if invalid)

---

## 5) Out-of-Scope (Explicit Non-Goals)
- Real money, deposits/withdrawals, cash-out, payments, crypto
- Public permissionless trading with external liquidity providers
- Multi-outcome markets
- Order book matching engine
- Advanced compliance features (KYC/AML)
- Complex dispute resolution beyond the bond/challenge process
- Social features beyond MVP
- High-frequency performance optimizations

---

## 6) Market Rules, Templates, and Resolution System (UPDATED)

### 6.1 Strict market templates (creator must choose resolution type)
Market creation is template-driven. A creator (admin in MVP) must choose one of the allowed **resolution types** and provide the required fields. Free-form “hand-wavy” markets are rejected.

**Required for every market:**
- `question` (binary YES/NO, unambiguous)
- `close_time` (trading stops)
- `resolution_type` (one of allowed)
- `resolution_deadline` (latest time to finalize or invalidate)
- `resolution_source` (text, and URL if applicable)
- `resolution_rule` (type-specific; e.g., selector/path/manual statement)
- `challenge_window_hours` (type-specific default)

### 6.2 Allowed resolution types (MVP)

#### A) `URL_SELECTOR` (auto-resolution via HTML check)
Use when resolution can be read from a stable public webpage.
- Required:
  - `resolution_url`
  - `selector` (CSS selector) and optional `match_regex`
  - `operator` and `compare_value` (or `yes_condition`)
- Example:
  - “Regulator dockets application by DATE?”  
    URL points to docket page; selector reads docket date; rule checks `<= DATE`.

**Auto-resolution behavior:**
- After close, the system fetches the URL server-side, extracts text via selector, applies rule, and determines YES/NO.

#### B) `JSON_PATH` (auto-resolution via API/JSON)
Use when resolution can be read from a JSON endpoint.
- Required:
  - `resolution_url`
  - `json_path` (e.g., `$.data.status.date`)
  - `operator` and `compare_value`
- Example:
  - “SEC filing exists by DATE?” from EDGAR JSON

**Auto-resolution behavior:**
- After close, the system fetches JSON server-side, reads the path, applies rule, and determines YES/NO.

#### C) `MANUAL_WITH_BOND` (user-proposed resolution + challenge)
Use when automatic parsing is not reliable, but evidence can be linked.
- Required:
  - `evidence_requirements` text describing what counts as evidence
  - `challenge_window_hours` (default 48)
  - `proposal_bond_points` and `challenge_bond_points` (defaults below)

**Resolution flow:**
1) After close, any eligible user can propose YES/NO with evidence link(s) and a bond.
2) If unchallenged during the window, proposal finalizes automatically.
3) If challenged, it escalates to admin review (or jury system post-MVP).

### 6.3 Auto-resolution for queryable sources
For `URL_SELECTOR` and `JSON_PATH` markets:
- The system attempts auto-resolution at close and repeats on a schedule until:
  - resolved successfully, or
  - reaches `resolution_deadline` and then invalidates/refunds.

**Scheduling (MVP):**
- Prefer a simple server-triggered check:
  - Run check when market page is loaded (server component) AND
  - Run a periodic job if available (Vercel Cron or Supabase scheduled function).
- Keep checks rate-limited.

### 6.4 User-propose + bond + challenge window (MANUAL_WITH_BOND)

#### Eligibility to propose/challenge (anti-spam)
A user must satisfy at least one:
- Account age ≥ 7 days, OR
- ≥ 5 trades on the platform, OR
- Admin

(Implement simplest rule first: account age check.)

#### Suggested bond amounts (points)
- `proposal_bond_points`: **500**
- `challenge_bond_points`: **500**

These are meaningful but not punitive given a 10,000 point starting balance.

#### Who receives bonds
- If proposal finalizes unchallenged:
  - proposer bond is **returned** to proposer.
- If challenged and proposal is ultimately upheld:
  - proposer bond is returned; challenger bond is **forfeited** and paid to proposer.
- If challenged and proposal is overturned:
  - challenger bond is returned; proposer bond is **forfeited** and paid to challenger.

This makes bad proposals/challenges costly and keeps dispute rates low.

#### Exact challenge window mechanics
- Market closes at `close_time` (no trading after).
- For `MANUAL_WITH_BOND` markets:
  - Proposals can be submitted starting immediately after `close_time`.
  - The **first proposal** opens the challenge window.
  - Challenge window length: `challenge_window_hours` (default 48).
  - Challenges must be submitted before `proposal_created_at + challenge_window_hours`.
  - MVP simplification:
    - Only **one ACTIVE proposal** at a time.
    - If challenged, proposal becomes CHALLENGED and further proposals are blocked until admin decides.
- If no proposal is submitted by `resolution_deadline`, market becomes **INVALID_REFUND**.

### 6.5 Escalate only disputed cases to admin
Admin intervention occurs only if:
- A `MANUAL_WITH_BOND` proposal is challenged, OR
- Auto-resolution fails repeatedly and becomes ambiguous, OR
- Evidence/source is missing/changed and needs invalidation decision.

Admin actions:
- Choose YES/NO/INVALID_REFUND
- Add resolution notes
- Trigger settlement/refund and bond transfers

### 6.6 Refund/Invalid fallback to prevent endless limbo
Markets must not remain in limbo.

**Invalid state:**
- `INVALID_REFUND`: cannot be resolved by deadline; users refunded.

**Refund rule:**
- Refund each user’s `net_spent_points` for that market:
  - Sum(BUY costs) − Sum(SELL proceeds)

Simplest MVP recommendation:
- Implement **BUY-only** trading (no SELL). This makes refunds trivial and avoids negative net spends.

**When to invalidate:**
- If `resolution_deadline` passes without successful finalization
- If source unavailable for > N attempts (recommend N=10) over the post-close period
- If parsing fails and cannot be corrected quickly
- If evidence is contradictory and admin cannot confidently decide

### 6.7 Edge-case handling
- **Source unavailable / rate limited:** retry with exponential backoff; invalidate at deadline.
- **Selector/path returns empty or ambiguous:** treat as unresolved; retry; invalidate at deadline.
- **Partial/conflicting evidence (manual):** if challenged, admin decides using the pre-defined evidence requirements; otherwise invalidate.
- **Ambiguous market wording:** prevent at creation; admin may invalidate post-close if discovered.

---

## 7) UX and UI Requirements
- Nuclear-tech aesthetic: clean, minimal, subtle green accents acceptable.
- Trading shows: current price, estimated cost, post-trade price.
- Resolution panel shows: type, source, rule, close time, resolution deadline, and (manual) propose/challenge CTA + countdown.

---

## 8) Pricing Model (LMSR) Requirements
Implement LMSR for binary outcomes with outstanding shares `q_yes`, `q_no`.
Default `b = 500`.

- `C(q_yes, q_no) = b * ln( exp(q_yes/b) + exp(q_no/b) )`
- `p_yes = exp(q_yes/b) / ( exp(q_yes/b) + exp(q_no/b) )`

Numerical stability via log-sum-exp.
Reject trades after close or exceeding balance.
Trade execution must be atomic.

---

## 9) Data Model (Supabase Postgres) (UPDATED)
Use UUIDs. All timestamps in UTC.

### Tables

#### `profiles`
- `id` uuid PK (auth.users)
- `display_name` text nullable
- `is_admin` boolean default false
- `points_balance` bigint default 10000
- `created_at` timestamptz default now()

#### `markets`
- `id` uuid PK
- `title` text
- `question` text
- `category` text nullable
- `status` enum: OPEN/CLOSED/RESOLVING/RESOLVED/INVALID_REFUND
- `close_time` timestamptz
- `resolution_deadline` timestamptz
- `resolution_type` enum: URL_SELECTOR/JSON_PATH/MANUAL_WITH_BOND
- `resolution_source` text
- `resolution_url` text nullable
- `resolution_rule` jsonb
- `resolved_outcome` enum YES/NO nullable
- `resolution_notes` text nullable
- `resolved_at` timestamptz nullable
- `invalid_reason` text nullable
- `b` double default 500
- `q_yes` double default 0
- `q_no` double default 0
- `created_by` uuid FK profiles.id
- `created_at` timestamptz default now()

#### `trades`
- `id` uuid PK
- `market_id` uuid FK
- `user_id` uuid FK
- `outcome` enum YES/NO
- `side` enum BUY/SELL
- `quantity` double
- `cost_points` bigint
- `price_before` double
- `price_after` double
- `created_at` timestamptz default now()

#### `positions`
- `id` uuid PK
- `market_id` uuid FK
- `user_id` uuid FK
- `yes_shares` double default 0
- `no_shares` double default 0
- `net_spent_points` bigint default 0
- `realized_pnl` bigint default 0
- `updated_at` timestamptz default now()
- Unique (`market_id`, `user_id`)

#### `resolution_proposals`
- `id` uuid PK
- `market_id` uuid FK
- `proposed_by` uuid FK
- `proposed_outcome` enum YES/NO
- `evidence_url` text nullable
- `evidence_note` text nullable
- `bond_points` bigint
- `status` enum ACTIVE/CHALLENGED/FINALIZED/REJECTED
- `challenge_deadline` timestamptz
- `created_at` timestamptz default now()

#### `resolution_challenges`
- `id` uuid PK
- `proposal_id` uuid FK
- `market_id` uuid FK
- `challenged_by` uuid FK
- `challenge_outcome` enum YES/NO
- `evidence_url` text nullable
- `evidence_note` text nullable
- `bond_points` bigint
- `created_at` timestamptz default now()

### RLS (minimum)
- Users can read their own profile/positions/trades.
- Markets readable by all; create/update restricted to admins.
- Proposals/challenges readable by all; inserts allowed to eligible authenticated users; updates restricted.

---

## 10) API / Server Actions (UPDATED)
1. `createMarket` (admin)
2. `placeTrade` (atomic)
3. `attemptAutoResolve` (auto types)
4. `proposeResolution` (manual)
5. `challengeResolution` (manual)
6. `adminResolveDispute` (admin)
7. `invalidateMarket` (admin or system at deadline)

Recommended: implement atomic operations as Supabase Postgres RPC.

---

## 11) Settlement Rules (UPDATED)
### Resolved YES/NO
- payout = winning shares * 1 point
- realized_pnl = payout - net_spent_points
- points_balance += payout
- clear position

### Invalid / Refund
- refund = net_spent_points
- realized_pnl = 0
- points_balance += refund
- clear position

MVP recommendation: BUY-only trading.

---

## 12) Acceptance Criteria (Definition of Done)
1. Deploys on Vercel free with Supabase free.
2. Users trade with points and see balances/positions update.
3. Strict templates enforce resolution type + required fields.
4. Auto markets resolve from URL selector / JSON path.
5. Manual markets support propose + bond + challenge window.
6. Only challenged manual markets require admin decision.
7. Invalid/refund fallback works and prevents limbo.
8. RLS prevents cross-user data access.

---

## 13) Seed Data
Include markets across all resolution types with clear source/rule.

---

## 14) Post-MVP Enhancements
- Price history charts
- Selector/path test tooling in admin
- Jury-based dispute resolution to reduce admin further
- Sell/short + risk controls
