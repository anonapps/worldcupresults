# World Cup Simulator 2026

Production-grade Next.js scaffold for a FIFA World Cup 2026 public simulator.

## Stack
- Next.js App Router + TypeScript
- Tailwind CSS
- Supabase
- Vitest + React Testing Library
- Playwright

## Getting Started
1. Copy `.env.example` to `.env.local` and configure values.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run development server:
   ```bash
   npm run dev
   ```

## Project Structure
- `app/` routes, layout, error/loading boundaries, API + cron routes
- `components/` reusable UI primitives/layout
- `lib/` shared helpers and env access
- `services/` external integrations
- `hooks/` reusable React hooks
- `types/` Type definitions
- `locales/` i18n dictionaries (en/es)
- `tests/` unit and e2e scaffolding
