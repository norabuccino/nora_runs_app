# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**nbb_running_app** — helps the user plan marathon training and strength training.

- **Repo:** https://github.com/norabuccino/nbb_running_app
- **Domain:** noraboo22.com
- **Stack:** Next.js App Router, Supabase (auth + database), Tailwind CSS, Vercel

## Commands

```bash
npm run dev      # Start dev server at localhost:3000
npm run build    # Production build
npm run lint     # ESLint
```

Node.js is installed at `/opt/homebrew/bin/node`. If `npm` is not found in PATH, use `/opt/homebrew/bin/npm`.

## Deployment

Push to the `main` branch on GitHub — Vercel auto-deploys on every push.

## Environment Variables

All three variables are required. Values live in `.env.local` locally and in Vercel's dashboard for production.

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_SITE_URL
```

## Architecture

### Supabase client pattern

There are two Supabase clients — use the right one for the context:

- `src/lib/supabase/client.ts` — browser client, use in `"use client"` components
- `src/lib/supabase/server.ts` — server client, use in Server Components and Route Handlers (async, reads/writes cookies)

### Auth flow

Auth is enforced in `src/middleware.ts`, which runs on every request. It redirects unauthenticated users away from `/dashboard` and `/protected`, and redirects authenticated users away from `/auth/*` (except `/auth/callback`).

The email confirmation flow: signup → Supabase sends email → user clicks link → `/auth/callback/route.ts` exchanges the code for a session → redirect to `/dashboard`.

Sign-out is a POST route at `/auth/signout/route.ts` (not a client-side action) to avoid CSRF issues.

### Adding new protected routes

Extend the `isProtectedRoute` check in `src/middleware.ts` to cover any new route prefix that requires authentication.

### Database schema changes

**Every schema change requires three things — all three, every time:**

1. **Migration file** — create a new file in `supabase/migrations/` named `YYYYMMDDHHMMSS_description.sql` (timestamp must be newer than the previous migration). Write the SQL using `CREATE TABLE IF NOT EXISTS` and `DROP POLICY IF EXISTS` / `CREATE POLICY` so it is safe to re-run.

2. **TypeScript types** — update `src/types/database.ts` to reflect the new or changed table (add/modify the `Row`, `Insert`, and `Update` shapes, and any convenience type aliases at the bottom).

3. **Apply the migration** — run this exact command (credentials are in `.env.local`):

```bash
SUPABASE_ACCESS_TOKEN=$(grep ^SUPABASE_ACCESS_TOKEN .env.local | cut -d'=' -f2) \
  /opt/homebrew/bin/supabase db push \
  --db-url "postgresql://postgres:$(grep ^SUPABASE_DB_PASSWORD .env.local | cut -d'=' -f2 | sed 's|/|%2F|g')@db.btkvovgfsrfvikktoyun.supabase.co:5432/postgres"
```

This reads credentials directly from `.env.local` — no manual login or terminal required. Claude can run this command.

Never edit the database schema directly in the Supabase dashboard — changes made there without a corresponding migration file will be lost and will drift from the codebase.

### Path alias

`@/*` maps to `src/*` (configured in `tsconfig.json`).
