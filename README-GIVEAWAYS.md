# Giveaways Module

## Features
- Create, schedule, and auto-end giveaways with fair weighted RNG.
- Real-time entrant, end, and reroll updates via Socket.io (`dashboard_event`).
- Discord publish and automatic winner announcement when ending.
- Reroll support with exclusion of previous winners.
- CSV export of entrants.
- Permissions & rate limits (env configurable).
- Basic analytics (in-memory + optional Mongo persistence).

## API Endpoints (base: `/api/guilds/:guildId/giveaways`)
- `GET /guilds/:guildId/giveaways` – list with filters (status, search).
- `POST /guilds/:guildId/giveaways` – create (requires manage permission).
- `GET /guilds/:guildId/giveaways/:giveawayId` – detail + counts.
- `PATCH /guilds/:guildId/giveaways/:giveawayId` – safe updates before start / limited during active.
- `POST /guilds/:guildId/giveaways/:giveawayId/enter` – enter active giveaway.
- `POST /guilds/:guildId/giveaways/:giveawayId/end` – force end now.
- `POST /guilds/:guildId/giveaways/:giveawayId/reroll` – reroll winners (ended only).
- `GET /guilds/:guildId/giveaways/:giveawayId/entries/export` – CSV export.
- `POST /guilds/:guildId/giveaways/:giveawayId/publish` – publish initial Discord message.

## Socket Events (`dashboard_event` payload `type`)
- `giveaway_enter` `{ giveawayId, userId }`
- `giveaway_end` `{ giveawayId, winners[], seed }`
- `giveaway_reroll` `{ giveawayId, winners[] }`

## Environment Variables
- `GIVEAWAYS_MAX_ACTIVE` (default: 5)
- `GIVEAWAYS_CREATE_COOLDOWN_MS` (default: 60000)
- `GIVEAWAYS_MANAGER_ROLES` (comma-separated role IDs granting management rights)
- `GIVEAWAYS_WORKER_ENABLED` (`true`/`false`)
- `GIVEAWAYS_ANALYTICS_PERSIST` (`mongo` to persist analytics)

## Data Models
See `utils/db/giveawayModels.js` for: Giveaway, GiveawayEntry, GiveawayWinner, GiveawayLog.

## RNG Fairness
- Weighted sampling without replacement using cumulative weights.
- Deterministic auditing with published seed (`fair_rng_seed`).
- Excludes bots and (optionally) suspicious alts.

## Rate Limiting
- Active count check (scheduled + active).
- Per-guild creation cooldown.

## Analytics
`utils/analytics.js` maintains in-memory buffer; persist by enabling env flag. Events: `giveaway_create`, `giveaway_enter`, `giveaway_end`, `giveaway_reroll`.

## Accessibility
- Wizard modal: focus trapped on open, first field auto-focused, returns focus to trigger on close.
- Live regions for entrant/end/reroll updates.

## i18n
- Strings stored in `dashboard/next/lib/i18n-giveaways.ts` with PT and EN keys.

## Future Enhancements
- Jest test suite (unit + integration) – pending.
- Anti-cheat heuristics & role-based weighting integration.
- UI real-time winner badges post reroll.
- Full audit export (logs + winners + seed).
