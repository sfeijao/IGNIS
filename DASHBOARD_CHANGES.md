# IGNIS Dashboard Rework (Next.js + Tailwind)

- Added robust client/server contract fixes for Moderation (automod events review and appeals decision)
- Fixed 404 for Next.js RSC index.txt by serving `/route/index.txt` from the export dir
- Topbar: added Logout button
- New hooks: `useApi`, `useAuth` for consistent API calls and auth state
- Added `dashboard/next/services/api.ts` re-export for API client and tsconfig inclusion of services
- Ensured builds succeed and static export is updated under `dashboard/public/next-export`

## Run locally

- Create `.env` from `.env.example` and fill required variables
- Start the bot (which starts the dashboard):
  - `npm install`
  - `npm run build` (if applicable)
  - `node index.js`
- Next.js static export is served under `/next`

## Notes

- Storage supports MongoDB (recommended) or JSON/SQLite fallback
- Moderation endpoints require staff permissions
- If you deploy to Railway, ensure BASE_URL matches your public domain
