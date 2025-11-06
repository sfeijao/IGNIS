# IGNIS Dashboard Rework (Next.js + Tailwind)

## 2025-11-05 Highlights

- Per-guild branding: banner and icon
  - Banner supports GIF (animation preserved). Upload via Settings > Bot.
  - New upload flow with drag-and-drop, client-side resize/compress, and success/error toasts.
  - New optional “Crop to fill (1600×400)” toggle to center-crop banners to exact size; default is fit-inside.
  - Icon upload/URL with preview; used for embed thumbnails across panels, verification preview, and webhook tests.
- Tickets overhaul: cleaner TicketPanels, safer update flows, and better validations in TicketsConfigForm.
- Verification upgrades: more methods, DM dry-run preview, broader channel filtering (includes Announcement/unknown types).
- i18n: full PT/EN coverage for new Settings and upload UI texts.
- Static Next export: stable pipeline with basePath/assetPrefix “/next”; post-build copies export to `dashboard/public/next-export`.
- Noise reduction: generated static HTML ignored from Problems panel; CI TypeScript config relaxed via ignoreDeprecations.

Notes:
- Upload limits are ~2.5MB on the client. GIFs are not compressed to preserve animation.
- Banner/icon are guild-scoped visuals for future embeds; they don’t retroactively update old messages.

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
