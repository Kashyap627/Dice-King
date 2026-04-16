# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

### RollRaja (`artifacts/rollraja`)
- **Type**: React + Vite web app
- **Preview path**: `/`
- **Stack**: React, TypeScript, Tailwind CSS, Web Audio API
- **No backend required** — pure client-side with localStorage persistence

#### Game Description
Luxury casino-style dice game. Two players roll dice showing only faces 1, 3, 4, 6.
- Double 1 or 3 → roller loses
- Double 4 or 6 → roller wins
- No double → turn alternates, same matchup continues
- After 6 no-doubles → roller wins by default

#### Key Files
- `src/App.tsx` — top-level screen router (login → lobby → game)
- `src/components/LoginScreen.tsx` — OTP login (simulated, OTP shown on screen)
- `src/components/LobbyScreen.tsx` — table selection (Bronze/Silver/Gold/VIP)
- `src/components/GameTable.tsx` — main game engine + table UI
- `src/components/Dice.tsx` — 3D rectangular ivory dice with ring pips
- `src/lib/game.ts` — game rules, types, constants
- `src/lib/audio.ts` — Web Audio API sounds (no external files)
- `src/index.css` — luxury casino CSS theme

#### Features
- 8 seats circular table, bots auto-fill empty seats
- Bet system: both active players bet per round, winner takes pot
- Side bets: spectators can bet on either active player
- 5-second countdown before each roll
- No-double tracker (6 max before default win)
- localStorage persistence of user account & balance
- All sounds via Web Audio API (no external files)
- Four tables: Bronze ₹10 / Silver ₹50 / Gold ₹100 / VIP ₹500
- Indian Rupee currency, ₹500 welcome bonus
