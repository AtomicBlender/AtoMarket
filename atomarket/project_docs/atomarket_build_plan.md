# AtoMarket MVP Build Plan (Implemented Baseline)

This repo now includes a full MVP baseline for:
- Neutron-based accounting
- LMSR buy-only trading
- Template-based market creation
- Auto and manual resolution flows
- Portfolio and admin dispute pages

## Delivered Artifacts
- Supabase schema/RPC migration: `supabase/migrations/20260305093000_atomarket_mvp.sql`
- Seed data: `supabase/seed.sql`
- Domain math/validation/resolution utilities: `lib/domain/*`
- Server actions: `lib/actions/market.ts`
- Data queries: `lib/actions/query.ts`
- App routes:
  - `/`
  - `/markets`
  - `/markets/[id]`
  - `/markets/new`
  - `/portfolio`
  - `/admin`
  - `/api/resolve`
- Vercel cron schedule: `vercel.json`

## Remaining Operational Steps
1. Apply Supabase migration and seed in your target project.
2. Set first admin user with `profiles.is_admin = true`.
3. Configure Vercel env vars from `.env.example`.
4. Run acceptance testing for RLS and settlement behavior in staging.
