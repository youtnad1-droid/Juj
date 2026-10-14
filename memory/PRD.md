# Find My Digital Gems (JUJ) — PRD

## Original request
Clone https://github.com/appsumonadi/find-my-digital-gems.git (public) into this workspace for continued editing and show a preview.
User choices: keep the project exactly as built; show preview even if outside keys are missing and list them.

## Architecture (as cloned, unchanged)
- Lovable TanStack Start app (React 19, Vite 8, Tailwind 4, shadcn) lives in /app/frontend
- Data + auth: Supabase (Lovable Cloud) via publishable key in /app/frontend/.env
- REST API inside the same app: /api/v1/* (categories, offers, offer detail, sellers, search, favorites, auth)
- /app/backend (FastAPI template) is not used by this project

## Changes needed to run here (2026-06)
- package.json: added `start` script -> `NODE_OPTIONS=--experimental-websocket vite dev --host 0.0.0.0 --port 3000 --strictPort` (pod has Node 20; supabase-js wants Node 22)
- .yarnrc: `--ignore-engines true`
- vite.config.ts: `vite.server.allowedHosts: true` so the preview domain works
- .env: kept repo Supabase vars + original REACT_APP_BACKEND_URL
- Old CRA template backed up to /tmp/frontend_cra_backup (temporary)

## Implemented (from repo, phase 1 of 8)
Home, category pages, offer page, seller page, search, auth (login/forgot/reset), favorites, orders placeholder, light/dark/system theme.

## Missing / not configured
- SUPABASE_SERVICE_ROLE_KEY (only used by admin server client; storefront works without it)
- LOVABLE_CRON_SECRET (cron auth; not used yet)

## Backlog
- P1: Checkout & payments, seller cabinet, admin panel (later phases per README)
- P2: Upgrade to Node 22 runtime to drop the websocket flag
