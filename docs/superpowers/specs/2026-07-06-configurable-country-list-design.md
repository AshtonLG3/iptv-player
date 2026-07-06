# Configurable Country List — Design

## Purpose

Replace the hardcoded 16-country SADC allow-list with a user-editable set
of included countries, defaulting to SADC + UK, manageable through an
in-app settings panel. Everything else the app already does (search,
per-country display filter, category filter, favorites, last-watched,
playback, error handling) keeps working exactly as it does today — it just
now operates over whichever countries the user currently has included,
instead of a fixed set.

The app is renamed from "SADC IPTV Player" to "IPTV Player" to reflect
that country scope is no longer SADC-specific.

## Scope

- In scope: making the included-country set user-editable and persisted;
  renaming the app; restoring the "now playing" name/logo display that the
  original design called for but the first implementation dropped.
- Out of scope: search UI for the settings panel (a plain scrollable
  checkbox list is sufficient at ~100 entries); per-country channel counts
  in the settings panel; any account/sync mechanism (still `localStorage`
  only, still single-browser, single-device).

## Architecture change

Filtering moves from parse-time to render-time:

- **Before:** `loadChannels()` fetched the playlist, parsed it, and
  immediately filtered to the hardcoded SADC country list before caching
  and returning — only ~70 channels ever existed in the app's memory.
- **After:** `loadChannels()` fetches and parses the *full* global
  playlist (~13,000 channels) and caches that, unfiltered, in
  `sessionStorage`. `app.js` then filters that full list down to the
  user's currently-selected countries before handing it to the UI. This is
  a plain JS array filter over ~13,000 objects — negligible cost, no
  pagination or virtualization needed.

This means `sessionStorage`'s cached playlist grows from ~70 entries to the
full playlist (still well under typical `sessionStorage` quota limits).

## Data model

- `src/constants.js`:
  - `COUNTRY_NAMES`: a static `{ [lowercase-iso-alpha-2]: displayName }`
    map covering the standard ISO 3166-1 alpha-2 country list (~250
    entries), replacing the old 16-entry `SADC_COUNTRIES`.
  - `DEFAULT_COUNTRY_CODES`: `['ao','bw','km','cd','sz','ls','mg','mw','mu','mz','na','sc','za','tz','zm','zw','gb']`
    — the original 16 SADC codes plus `gb` (United Kingdom) — used as the
    seed default the first time the app runs (before the user has ever
    changed their selection).
- `src/parser.js`: `filterBySadc(channels)` is replaced by
  `filterByCountries(channels, countryCodes)`, where `countryCodes` is an
  array/Set of lowercase ISO codes to keep. `extractCountryCode` is
  unchanged.
- `src/storage.js`: two new functions, following the existing
  storage-parameterized pattern:
  - `getSelectedCountries(storage)` — returns the persisted array of
    country codes, or `DEFAULT_COUNTRY_CODES` if nothing is stored yet.
  - `setSelectedCountries(storage, countryCodes)` — persists the array as
    JSON, same pattern as `toggleFavorite`.
  - Both operate on `localStorage` (selection persists across sessions,
    unlike the `sessionStorage` playlist cache).

## UI

- **Manage countries panel:** a button in the sidebar ("Manage
  countries…") toggles an inline collapsible section (expands/collapses
  in place below the button, no modal/overlay) listing every country code
  present in the
  *full* unfiltered playlist as a checkbox, labeled via `COUNTRY_NAMES`
  (falling back to the raw uppercase code for any code somehow missing
  from the table), sorted alphabetically by name. Checkboxes are
  pre-checked according to the current selection (`getSelectedCountries`).
  Checking or unchecking a box immediately persists the new selection
  (`setSelectedCountries`) and re-filters/re-renders the main channel list
  — no separate "Save" step.
- **Existing per-country display dropdown** (the single-select "All
  countries" filter) is unchanged in behavior: it's still built from
  whatever channels are currently visible, which are now the
  already-included-countries subset rather than a hardcoded SADC subset.
- **Now playing:** a small header above the video showing the selected
  channel's name and logo (`<img>`, hidden if the channel has no
  `logo` value). Updates on every channel selection; this is the piece
  the original design spec called for but the first implementation
  plan dropped.

## Data flow (updated)

1. `loadChannels()` fetches, parses, and caches the full playlist
   (unfiltered) in `sessionStorage`, as before minus the SADC filter step.
2. `app.js` reads `getSelectedCountries(localStorage)` (seeded with
   `DEFAULT_COUNTRY_CODES` on first run) and computes
   `visibleChannels = filterByCountries(allChannels, selectedCountries)`.
3. `renderApp` receives `visibleChannels` and renders the sidebar
   (search/category/favorites filters + list) exactly as today, plus the
   new "Manage countries" button.
4. Toggling a country in the settings panel calls back into `app.js`,
   which recomputes `visibleChannels` from the *same* cached full
   playlist (no re-fetch) and re-renders — mirroring how a favorite
   toggle already triggers a re-render today.

## Error handling

No changes to existing error handling (playlist fetch failure, per-channel
playback failure). The settings panel has no failure mode of its own —
checkbox state changes are synchronous `localStorage` writes.

## Renaming

- `index.html`: `<title>` and visible heading change from "SADC IPTV
  Player" to "IPTV Player".
- `README.md`: description updated to describe the app as covering a
  user-configurable set of countries (defaulting to SADC + UK) rather
  than "SADC channels".
- No change to the project directory name or repo (`iptv-player` was
  already generically named).

## Testing plan

Automated (Node test runner, extending the existing suite):
- `filterByCountries` with an arbitrary code list (replacing the old
  `filterBySadc` tests).
- `getSelectedCountries` / `setSelectedCountries` round-trip and
  default-seeding behavior when nothing is stored yet.

Manual (browser, mirroring the original app's verification pass):
- Default selection on first run includes SADC + UK channels only.
- Opening "Manage countries", unchecking a country, confirms its channels
  disappear from the list immediately; re-checking brings them back.
- A freshly-added country (e.g. checking one outside the default set)
  shows real channels for that country, with a real country name in the
  panel (not a raw code).
- Selecting a channel shows its name and logo in the new "now playing"
  header; a channel with no logo hides the image without a broken-image
  icon.
- Selected countries persist across a page reload; the playlist itself is
  still re-fetched fresh each new browser session (sessionStorage-scoped),
  per the existing caching design.
