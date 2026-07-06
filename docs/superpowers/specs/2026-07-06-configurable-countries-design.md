# Configurable Country List — Design

## Purpose

Replace the hardcoded "SADC countries only" scope with a user-editable set
of included countries, so the app can grow beyond the original 16 SADC
countries (starting with adding the UK) without further code changes. All
existing behavior (search, per-country display filter, category filter,
favorites, last-watched, playback, error handling) is unchanged — it now
just operates over whichever countries the user has currently included.

Since the app is no longer SADC-specific, it is renamed from "SADC IPTV
Player" to "IPTV Player".

## Scope

- Default included countries on first run: the original 16 SADC codes
  (`ao`, `bw`, `km`, `cd`, `sz`, `ls`, `mg`, `mw`, `mu`, `mz`, `na`, `sc`,
  `za`, `tz`, `zm`, `zw`) plus `gb` (United Kingdom) — 17 codes total.
- A "Manage countries" settings panel lists every country code present in
  the *full, unfiltered* iptv-org playlist as a checkbox, labeled with a
  real country name, pre-checked according to the user's current
  selection. Toggling a checkbox immediately adds/removes that country
  from scope and re-renders the channel list.
- The selection persists in `localStorage` so it survives reloads,
  independent of the `sessionStorage` playlist cache.
- No change to how many countries can be selected (any subset of what's
  present in the playlist, including none or all).

## Architecture change

Filtering moves from parse-time to render-time:

- **Before:** `src/playlist.js`'s `loadChannels` parsed the playlist and
  immediately filtered to a hardcoded SADC allow-list before caching or
  returning anything.
- **After:** `loadChannels` returns and caches the *full* parsed playlist
  (all countries, ~13,000 channels). `app.js` reads the user's selected
  country codes from `localStorage` (seeded with the default 17 on first
  run) and filters the full list down to those countries before handing
  it to the UI. This is a plain JS array filter over already-in-memory
  data — no meaningful performance cost from caching/filtering the larger
  unfiltered set.

## Components

- **`src/constants.js`**
  - `COUNTRY_NAMES`: a static ISO 3166-1 alpha-2 → English country name
    map covering every code that can appear in the iptv-org playlist
    (~250 entries, no network fetch, no dependency).
  - `DEFAULT_COUNTRY_CODES`: array of the 17 default codes listed above.
  - The existing `SADC_COUNTRIES` export is removed (superseded by
    `COUNTRY_NAMES` + `DEFAULT_COUNTRY_CODES`).

- **`src/parser.js`**
  - `filterBySadc(channels)` is renamed/generalized to
    `filterByCountries(channels, countryCodes)`, taking an array or Set of
    country codes and returning only channels whose `country` field is in
    that set. `extractCountryCode` and `parseM3U` are unchanged.

- **`src/storage.js`**
  - New: `getSelectedCountries(storage)` — reads the persisted selection
    from storage; if nothing is stored yet, returns `DEFAULT_COUNTRY_CODES`
    (does not write anything on this read-only default).
  - New: `setSelectedCountries(storage, countryCodes)` — persists the
    array as JSON.
  - Existing favorites/last-watched functions are unchanged.

- **`src/ui.js`**
  - `renderApp` gains two new pieces of behavior, alongside the existing
    search/filter/favorites list rendering:
    1. A "now playing" header (channel name + logo `<img>`) shown above
       the video, updated whenever a channel is selected.
    2. A "Manage countries" toggle button that opens/closes a checkbox
       panel. The panel is built from the *full* unfiltered channel list's
       distinct country codes (passed in separately from the *visible*,
       already-filtered channel list), sorted by country name via
       `COUNTRY_NAMES`. Each checkbox reflects the current selection;
       changing one calls back out to `app.js` to persist the new
       selection and recompute the visible list.
  - The existing single-select "country" display-filter dropdown is
    unchanged in behavior — it's still built from the *visible* (already
    country-included) channel list, same as today.

- **`app.js`**
  - Loads the full channel list via `loadChannels` (now unfiltered).
  - Reads the selected countries via `getSelectedCountries`.
  - Computes the visible list via `filterByCountries`.
  - Passes both the full list (for the settings panel's country checkbox
    options) and the visible list (for the main channel list) into
    `renderApp`.
  - On a country-selection change from the settings panel, persists via
    `setSelectedCountries`, recomputes the visible list, and re-renders.
  - Updates the "now playing" name/logo whenever a channel is selected.

- **`index.html` / `README.md`**
  - Page title and heading updated from "SADC IPTV Player" to
    "IPTV Player".
  - `README.md` updated to describe the app as configurable-country
    rather than SADC-only, with SADC + UK as the example default.

## Data flow (updated)

1. On page load, `loadChannels` fetches (or reuses the `sessionStorage`
   cache of) the full, unfiltered playlist.
2. `app.js` reads the selected country codes from `localStorage`
   (`DEFAULT_COUNTRY_CODES` if unset).
3. `app.js` computes the visible channel list via `filterByCountries` and
   renders it, along with the full list's distinct countries for the
   settings panel.
4. Toggling a country checkbox updates the persisted selection and
   triggers steps 3 again (recompute + re-render), without re-fetching
   the playlist.

## Error handling

Unchanged from the original design — playlist fetch failure shows a
retry button; a channel that fails to play shows an inline "Can't play
this channel" message without affecting the rest of the app.

## Testing plan

- Automated (Node's built-in test runner, extending the existing suite):
  - `filterByCountries` filters correctly for an arbitrary code set
    (replacing the old SADC-specific test).
  - `getSelectedCountries`/`setSelectedCountries` round-trip correctly and
    default to `DEFAULT_COUNTRY_CODES` when nothing is stored.
- Manual (browser), extending the existing checklist:
  - On first load (no stored selection), the visible list matches the 17
    default countries (SADC + UK).
  - Opening "Manage countries" shows every country present in the full
    playlist, with real names, correctly pre-checked for the current
    selection.
  - Unchecking a country removes its channels from the visible list
    immediately; re-checking restores them — without re-fetching the
    playlist.
  - The selection persists across a page reload.
  - Selecting a channel updates the "now playing" name and logo, and
    clears/updates correctly when switching channels.
