# Task: Fix Prisma schema location on Render

## Step 1 — Inspect
- [x] Locate `schema.prisma` files across the repo.
- [x] Identify duplicate Prisma folders (`/prisma` and `/backend/prisma`).

## Step 2 — Consolidate Prisma
- [ ] Delete/move root-level `prisma/` so only `backend/prisma/` remains.

## Step 3 — Backend package.json
- [ ] Update `backend/package.json` scripts and `prisma.schema`.

## Step 4 — Code verification
- [ ] Confirm `@prisma/client` import usage in `backend/src/config/database.js`.
- [ ] Confirm `backend/src/index.js` entrypoint is correct.

## Step 5 — Render verification
- [ ] Ensure Render commands match expected Prisma commands.

## Step 6 — Final report
- [ ] Provide final folder structure and list of every modified/removed file with full contents for modified files.

