# TeroLibrary Redesign Correction

## This package fixes the previous incomplete transfer
The earlier package did not transfer the approved standalone prototype as a full replacement design. This package updates the real Next.js source.

## Included in this correction
- Redesigned home page hero, category navigation, resume-reading banner, separate recommendation and top rows for Books, Fan fiction, and Manga/Comics.
- Category-specific visual accents (neutral books, purple fan fiction, orange manga).
- Real work data is fetched from existing repository functions; links lead to existing work/catalog routes.
- Existing language route prefix (`sr`, `ru`, `en`) and server-side text dictionary are retained.
- Existing Bookverse catalog component and CSS are retained.
- Existing library route and data functions are retained.

## Important scope
This is not yet a complete site-wide conversion of every page to the approved prototype. Work, reader, profile, author, publisher, admin, subscription and account screens still need visual conversion and interaction QA. The home page redesign is implemented in `app/[lang]/page.tsx`; styles are appended in `styles/bookverse.css`.

## Build verification
The container's `node_modules` was incomplete: `npm run build` failed because the `next` executable was missing/permission-denied, and the direct Next build script was not present. Therefore build/type-check/browser QA has not been completed.

## Install/test
1. Back up production and database.
2. Extract this archive to a staging copy of the project.
3. Copy your environment file from the existing project; no `.env` secrets are included.
4. Run `npm ci`.
5. Run `npm run build`.
6. Start staging and verify the three language routes, home page categories, catalog filters, work pages, reader, and library.
7. Deploy only after successful QA.
