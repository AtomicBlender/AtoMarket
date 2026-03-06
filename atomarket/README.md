# AtoMarket 

AtoMarket is a neutron-based binary prediction market MVP built with Next.js + Supabase.

## Stack
- Next.js (App Router, TypeScript)
- Supabase (Postgres, Auth, RLS, RPC)
- Tailwind CSS + shadcn/ui primitives

## Key Features
- Binary YES/NO markets with LMSR buy-only trading
- Neutron accounting (`neutron_balance`, `cost_neutrons`, etc.)
- Resolution templates:
  - `URL_SELECTOR`
  - `JSON_PATH`
  - `MANUAL_WITH_BOND`
- Propose/challenge flow with neutron bonds
- Admin dispute queue with resolve/invalidate actions
- Portfolio, positions, and trade history
- Auto-resolution endpoint: `/api/resolve`
- Vercel cron schedule in `vercel.json`

## Setup
1. Copy `.env.example` to `.env.local` and add Supabase values.
2. Set `NEXT_PUBLIC_SITE_URL` to your canonical app URL (for example `https://your-app.com` in production).
3. In Supabase Dashboard -> Authentication -> URL Configuration:
   - Set `Site URL` to your production app URL (not `localhost`).
   - Add redirect URLs for local/dev/preview/prod as needed.
4. Set `CRON_SECRET` and configure your Vercel cron to send `Authorization: Bearer <CRON_SECRET>` for `/api/resolve`.
5. Apply migration: `supabase/migrations/20260305093000_atomarket_mvp.sql`.
6. Optionally seed sample markets with `supabase/seed.sql`.
7. Set at least one admin account in `profiles` (`is_admin = true`).
8. Install and run:
   - `npm install`
   - `npm run dev`

## Scripts
- `npm run dev`
- `npm run lint`
- `npm run build`

## Notes
- Trading is BUY-only for MVP.
- Currency naming is fully `neutrons` in DB, API, and UI.
- `/admin` requires authenticated `is_admin = true`.
