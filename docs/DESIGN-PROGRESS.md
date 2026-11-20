# TeroLibrary redesign progress

## Approved decisions
- Brand accent: `#8060B0`.
- Favorite/heart: light `#C2414D`, dark `#E0656F`.
- Cover ratio: 2:3.
- Default appearance: system; users can cycle System / Light / Dark.
- Fifth mobile navigation item: `Zajednica`.
- Author editor follows the site theme; a separate appearance control remains available.

## Stage 1 — design tokens and themes

**Status:** token layer implemented; runtime verification remains pending.

Token coverage in `app/prototype.css` now includes:
- Brand accent, strong accent, soft surface, accent-text and semantic deep colours.
- Canvas, panels, panel-2, text, muted text, line and field-border colours.
- Light/dark favorite and rating colours.
- Publisher, self-published, fan-fiction and graphic-literature colour pairs, deep backgrounds and contrast-safe text colours.
- System appearance via `prefers-color-scheme`, explicit `data-theme="light|dark"`, focus-visible and reduced-motion behavior.

## Stage 2 — shared application shell

**Status:** implemented in the working archive; runtime and browser verification remain pending.

Implemented:
- Replaced the old shared header markup with a TeroLibrary header inspired by Inkwell's composition: wordmark, centered direction tabs, search, language switcher, appearance control, notifications, wallet balance and reader profile/sign-in.
- Direction tabs route to existing catalog states: `publisher`, `selfpub`, `fanfic`, `comic` and `top`.
- Catalog tabs derive their active state from the current URL (including the default publisher/books view). A small category-theme binder applies the matching `.tlp-*` category token class without rewriting URL state.
- Global search preserves existing catalog query parameters other than the replaced `q` value. Direction tabs now update only `kind` and retain the other current catalog query parameters.
- Added the five-item floating mobile navigation pill: Home, Search, My library, Community and Profile. It marks the current destination and hides while scrolling down in the reader, then returns on upward scroll.
- Added a System / Light / Dark appearance cycle persisted in local storage. System mode follows the operating-system preference. Dark category pages retain dark canvas and dark divider tokens.
- Header wallet balance and notification count are read from the existing account/repository functions; no demo balance or fabricated account data is shown.
- Updated the shared footer links for all three locales.
- Added stage progress notes.

Temporary navigation note: until Stage 8 introduces the community feed, `Zajednica` currently opens the existing collections page. No separate community feature was fabricated in this stage.

## Files changed in Stage 2
- `app/[lang]/layout.tsx`
- `app/prototype.css`
- `components/Chrome.tsx`
- `components/SiteHeader.tsx`
- `components/DirectionTabs.tsx`
- `components/GlobalSearchForm.tsx`
- `components/AppearanceSwitcher.tsx`
- `components/BottomNavPill.tsx`
- `components/CategoryThemeBinder.tsx`
- `docs/DESIGN-PROGRESS.md`

No API handlers, database schema, repository/business-logic modules, or existing route files were changed.

## Verification status
- TypeScript/TSX transpile syntax check for the changed TSX files: passed.
- CSS parser check for `app/prototype.css`: passed, no parse errors.
- `npm run check`: blocked because dependencies are not installed (`vitest: not found`).
- Full `tsc --noEmit`: blocked by missing project dependencies/types (`next`, `react`, `vitest`, `@types/node`); output also contains existing type diagnostics that cannot be assessed without those dependencies.
- Runtime build: not run; current runtime is Node `22.16.0`, while `package.json` requires `^22.22.2 || ^24.15.0 || >=26.0.0`.
- Browser screenshots at 390 / 768 / 1440 px in both themes: not generated. Chromium navigation in this environment returned `ERR_BLOCKED_BY_ADMINISTRATOR`; no screenshots are claimed as runtime evidence.

## Stage 3 — Home page

**Status:** implemented; syntax/archive verification passed. Runtime and visual verification remain pending.

Implemented on the existing localized home route and existing repository data:
- Editorial hero with translated title/description, primary catalog and subscription actions, and featured covers from existing catalog results (no fabricated content).
- Four quick-entry category links using the existing catalog query states.
- Continue-reading card with current work/chapter and progress percentage for signed-in readers.
- Four direction cards with category colors and descriptions.
- Separate recommendation and Top shelves for publisher books, self-published works, fanfiction and graphic literature.
- Author call-to-action banner.
- Responsive layouts for desktop, tablet and mobile; cover ratio updated to 2:3 in home sections.

No API handlers, DB schema, repository/business-logic files or route definitions were changed.

### Verification
- TypeScript TSX transpilation diagnostics: 0.
- CSS parsing: passed.
- ZIP integrity: passed.
- Runtime build / browser screenshots: not run (environment dependency/runtime/browser restrictions from Stage 2 remain).


## Stage 4 — Catalog redesign
- Updated the catalog section navigation into a full-width, scrollable category rail with category-specific active states.
- Refined the catalog title/eyebrow hierarchy, controls, sort selector, result count, active-filter chips, and section headings.
- Redesigned work cards with 2:3 covers, larger metadata hierarchy, status pills, hover states, and responsive spacing.
- Implemented an actual list layout when the list-view toggle is selected (previously it used a grid class).
- Refined filter drawer spacing and control styling while retaining existing filter state and URL parameters.
- Kept server-side filtering, sorting, pagination, top-period queries, routes, and data contracts unchanged.
- Validation: TypeScript transpilation passed; ZIP integrity passed. Full Next.js build and browser screenshots remain unavailable in this environment due missing dependencies/runtime constraints.

## Stage 5 — Work detail and table of contents
- Redesigned the work detail hero with stronger title/author/rating hierarchy, 2:3 cover presentation, genre/fandom/pairing/format chips, AI disclosure, description, pricing summary, and action group.
- Refined the subscription/purchase/donation/export/follow/library actions visually without changing their underlying components or permissions.
- Restyled the chapter list as a distinct table-of-contents panel with clearer chapter rows, access labels, paid-chapter purchase controls, and responsive spacing.
- Refined review, comment, and related-work sections to fit the new panel and spacing system.
- Added mobile layout rules for the hero, cover, metadata, pricing, and chapter rows.
- No API handlers, database schema, repository/business-logic modules, or route definitions were changed.
- Validation: TSX syntax transpilation and ZIP integrity checked. Full Next.js build and browser screenshots remain unavailable due environment dependency/runtime/browser restrictions.

## Stage 6 — Reader and ComicReader
- Refined the text reader into a centered reading surface with responsive padding, adjustable typography variables, improved paragraph rhythm, and theme-aware foreground/background styling.
- Redesigned the floating reader-settings panel with a more polished panel surface, title hierarchy, hover states, and mobile placement; existing font, size, line-height, theme and local-storage preferences remain intact.
- Refined the comic reader toolbar and page presentation, including sticky controls, clearer button states, centered page images, and mobile toolbar spacing.
- Preserved page/scroll mode, width presets, zoom, double-tap zoom, pinch zoom, keyboard navigation, page fetching, locked chapter purchase flow, text translation/transliteration, paragraph comments, TTS permissions, progress saving, donations, and chapter navigation.
- No API handlers, database schema, repository/business-logic modules, or route definitions were changed.
- Validation: ZIP integrity checked. Full Next.js build and browser screenshots remain unavailable due environment dependency/runtime/browser restrictions.

## Stage 7 — Library, collections and profile
- Refined the personal library shell, category navigation, search/sort toolbar, status controls and cover cards.
- Refined collection cards and section hierarchy; mobile collection layout stacks into a single column.
- Profile settings card receives shared surface, border and responsive styling.
- Existing server/API behavior and statuses remain unchanged.
- Validation: ZIP integrity and source syntax checks; full Next build/browser visual validation unavailable in this environment.

## Stage 8 — Author, publisher and community
- Added a clearer author studio header and in-page navigation to works, statistics, income and donations.
- Added publisher dashboard header and section navigation for overview, reports, works, licenses, team and payouts.
- Added a localized community hub linking to existing catalogue, collections, author studio and publisher information routes; no fake social actions were introduced.
- Shared responsive styling uses the current design tokens and surface patterns.
- Validation: ZIP integrity and TSX syntax checks; full Next build/browser visual validation unavailable in this environment.


## Stage 9 — Admin, moderation and management surfaces
- Unified admin, reports/moderation, and publisher management pages with shared responsive width and surface styling.
- Refined hierarchy, tab navigation, cards, list rows, actions and mobile horizontal navigation.
- Preserved API calls, authentication/session behavior and moderation/payment actions.
- Validation: ZIP integrity and TSX syntax transpilation checked; full framework build/browser validation unavailable in this environment.

## Stage 10 — Final consistency pass
- Added a shared polish pass for account and notification surfaces.
- Harmonized utility-page headings, card borders, surface treatment, and hover feedback with the established design tokens.
- Improved narrow-screen notification row spacing and action sizing.
- Reviewed remaining route inventory: about, account, help, login/register, notifications, rules, storage, subscribe, public profiles and publishers. Existing page functionality remains unchanged.
- Validation: CSS appended and ZIP integrity checked. Full Next.js build and browser visual QA were not available in this environment.
