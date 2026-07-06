# Referrer/User-Agent Proxy for Restricted Streams — Design

## Purpose

Some streams in the iptv-org playlist declare that they require a
specific `Referer` and/or `User-Agent` header to be served at all —
visible in the M3U as `http-referrer`/`http-user-agent` attributes on the
`#EXTINF` line (and redundantly as `#EXTVLCOPT:` lines for VLC; ~422
entries playlist-wide as of this writing, e.g. a Spanish channel called
"EsTuTele"). Browsers forbid client-side JavaScript from setting either
header on any request (`fetch`/`XMLHttpRequest`) — this is a hard
platform restriction (both are in the Fetch spec's forbidden-header-name
list), not a policy choice, and it cannot be worked around from in-page
script. As a result, these specific streams currently fail with the
existing best-effort "Can't play this channel" error, indistinguishable
from a genuinely dead stream.

This adds a small local proxy, run as part of the app's own dev server,
that fetches exactly these flagged streams server-side (where custom
headers are unrestricted) and re-serves them to the browser. It is scoped
**only** to channels that declare a required referrer/user-agent — every
other channel continues to stream directly from its origin, unchanged.

**Confirmed limitation:** SABC's channels in the live playlist are tagged
`[Geo-blocked]` by iptv-org's own curators and declare no
`http-referrer`/`http-user-agent` at all — their block is genuine
IP-based geolocation, not a header check. A *local* proxy (running on the
same machine and internet connection as the browser) cannot change the
apparent client IP, so this feature does not and will not unblock SABC.
It's still worth building for the ~422 other playlist entries that
genuinely require a referrer/user-agent to play. This proxy does not,
and is not intended to, bypass IP-based geographic restrictions — it
only supplies header values a stream's own M3U entry already declares
are required to play it at all.

## Scope

- In scope: detecting which channels declare `http-referrer`/
  `http-user-agent`; a local proxy that fetches those streams with the
  declared headers and rewrites HLS manifests so subsequent segment
  requests also route through it; routing only flagged channels through
  the proxy.
- Out of scope: bypassing IP-based geo-restrictions; proxying every
  channel by default; exposing the proxy beyond localhost; any
  authentication/access-control on the proxy itself (single local user,
  same threat model as the existing static file server).

## Architecture

The existing plain static-file server (`python -m http.server` /
`npx serve`) is replaced by a single small Node script, `server.js`, using
only Node's built-in `http`/`https` modules (no new dependencies):

- Any request whose path does **not** start with `/proxy` is served as a
  static file from the project root, exactly as the current static server
  does today.
- `GET /proxy?url=<encoded-stream-url>&referrer=<encoded-referrer>&userAgent=<encoded-ua>`:
  - Validates `url` is present and is `http:`/`https:` (rejects anything
    else, e.g. `file:`, to avoid the proxy being usable to read local
    files).
  - Fetches `url` server-side via `http`/`https`, setting `Referer`/
    `User-Agent` request headers from the (optional) query params.
  - If the response's content-type or the URL's extension indicates an
    HLS playlist (`.m3u8`), reads the body as text, rewrites every URI
    line in it (master and media playlists both use the same line-based
    format) into a proxied URL — resolving relative URIs against the
    original manifest's URL first — and serves the rewritten text with
    `content-type: application/vnd.apple.mpegurl`. This is what makes
    playback actually work end-to-end: without rewriting, the manifest
    would fetch fine through the proxy but every segment inside it would
    then be requested directly by the browser, hitting the same
    header-based rejection.
  - Otherwise (a segment file, e.g. `.ts`/`.m4s`/`.aac`), pipes the
    upstream response through unmodified — no rewriting needed for binary
    segment data.
  - On upstream fetch failure or non-2xx status, responds with an error
    status; this surfaces through hls.js's existing fatal-error path into
    the app's existing "Can't play this channel" UI — no new error UI.
  - Bound to `localhost` only (never `0.0.0.0`) — this proxy will fetch
    whatever URL it's given, so it must not be reachable from the local
    network, only from the machine running it.

Because `/proxy` is served by the *same* origin/port as the page itself,
`app.js` can reference it with a plain relative URL — no configuration or
port-passing needed between the static app and the proxy.

## Data model

- `src/parser.js`: the parsed `Channel` object gains two new optional
  fields, read from the same `#EXTINF` attribute set already being parsed
  (`http-referrer`, `http-user-agent`), defaulting to `''` when absent:
  `referrer` and `userAgent`. `#EXTVLCOPT:` lines remain skipped as
  before — they're a VLC-specific redundant encoding of the same two
  values already present as EXTINF attributes, confirmed against real
  playlist data.
- No changes to `src/storage.js` or `src/playlist.js`.

## Player wiring

In `app.js`'s `selectChannel`, before calling `player.play(channel.url)`:
- If `channel.referrer` or `channel.userAgent` is non-empty, construct a
  proxied URL: `/proxy?url=${encodeURIComponent(channel.url)}&referrer=${encodeURIComponent(channel.referrer)}&userAgent=${encodeURIComponent(channel.userAgent)}`
  and play that instead of the direct URL.
- Otherwise, play `channel.url` directly, exactly as today — the large
  majority of channels are entirely unaffected by this feature.

`src/player.js` itself needs no changes — it already just takes a URL
string and plays it; it doesn't need to know whether that URL points at
an origin stream or the local proxy.

## Error handling

No new error-handling paths in the browser: a proxy failure (upstream
down, non-2xx, network error) becomes a failed manifest load exactly like
any other broken stream, and surfaces via the existing `player.onError` →
`#player-status` "Can't play this channel" flow. The proxy itself logs
errors to its own server console for local debugging.

## Testing plan

Automated (Node test runner):
- The M3U-line-rewriting function (resolve relative/absolute URIs against
  a base URL, wrap each into a proxied `/proxy?...` URL, leave comment/
  blank lines untouched) is pure text transformation — testable directly
  with sample manifest text and a base URL, no real server or network
  needed.
- `src/parser.js`: new tests confirming `referrer`/`userAgent` are
  correctly extracted from `#EXTINF` attributes, and default to `''` when
  absent.

Manual (browser + running `server.js` locally):
- A channel with no `http-referrer`/`http-user-agent` plays exactly as
  before (direct URL, no proxy involved) — confirm via the network panel
  that the request goes straight to the origin, not through `/proxy`.
- A real playlist entry declaring `http-referrer`/`http-user-agent` (e.g.
  "EsTuTele") is selected, its manifest and segment requests are observed
  going through `/proxy`, and playback succeeds where it previously showed
  "Can't play this channel." (Not SABC — confirmed above to be true
  IP geo-blocking, unaffected by this feature.)
- Requesting `/proxy?url=file:///etc/passwd` (or similar) is rejected
  rather than proxied, confirming the http(s)-only guard.
