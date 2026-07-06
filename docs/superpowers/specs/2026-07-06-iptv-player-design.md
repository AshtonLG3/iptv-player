# SADC IPTV Player — Design

## Purpose

A small local web app for browsing and watching free-to-air channels from
SADC (Southern African Development Community) countries, sourced from the
public [iptv-org/iptv](https://iptv-org.github.io/iptv/index.m3u) playlist.

## Scope

- Countries: Angola (AO), Botswana (BW), Comoros (KM), DR Congo (CD),
  Eswatini (SZ), Lesotho (LS), Madagascar (MG), Malawi (MW), Mauritius (MU),
  Mozambique (MZ), Namibia (NA), Seychelles (SC), South Africa (ZA),
  Tanzania (TZ), Zambia (ZM), Zimbabwe (ZW).
- Exact country attribute format (e.g. `tvg-country="ZA"` vs full name) will
  be confirmed against the live playlist during implementation, since
  iptv-org's tagging conventions may vary by entry.
- No user accounts, no server-side component, no persistence beyond the
  browser (localStorage/sessionStorage).

## Architecture

Static site, no build step, no framework:

- `index.html` — page shell
- `style.css` — styling
- `app.js` — fetch, parse, render, playback logic
- `hls.js` loaded via CDN `<script>` tag for HLS playback in non-Safari
  browsers; native `<video>` HLS support used on Safari.

Run locally via any static file server (e.g. `python -m http.server` or
`npx serve`) — `fetch()` of a remote https URL requires http(s) origin, not
`file://`.

## Data flow

1. On page load, `fetch('https://iptv-org.github.io/iptv/index.m3u')`
   client-side. GitHub Pages serves permissive CORS headers, so this works
   directly from the browser with no proxy.
2. Parse the M3U text: each channel's `#EXTINF` line carries attributes such
   as `tvg-id`, `tvg-logo`, `tvg-country`, and `group-title` (often the
   category), plus the display name; the following line is the stream URL.
3. Filter the parsed list down to channels whose country attribute matches
   the SADC country list above.
4. Cache the filtered list in `sessionStorage` so reloading within the same
   session skips re-fetching and re-parsing the full playlist.

## UI

- Left panel:
  - Search box (filters by channel name)
  - Country dropdown (scoped to the 16 SADC countries present in the data)
  - Category dropdown (derived from `group-title` values present)
  - "Favorites" toggle
- Main panel: video player, current channel name and logo.
- Clicking a channel loads its stream URL into the player and attempts
  playback immediately.
- Favorites and "last watched channel" persist in `localStorage` so they
  survive page reloads.

## Error handling

- Playlist fetch fails → inline retry button, app stays usable (empty list
  state, no crash).
- A given channel fails to play (CORS blocked, dead stream, unsupported
  codec) → catch `hls.js` error events and the `<video>` element's `error`
  event, show a "Can't play this channel" message in the player area, leave
  the rest of the list interactive. No proxy, no automatic retry across
  channels — best-effort playback per channel.

## Testing plan

Manual verification via local static server:

- Playlist loads and is filtered to SADC-only channels.
- Search narrows the list by name; country/category dropdowns filter
  correctly.
- A known-good channel plays back successfully.
- A deliberately broken stream URL shows the error state without breaking
  the rest of the app.
- Favorites and last-watched channel persist across a page reload.
