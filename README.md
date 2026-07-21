# FTA IPTV Player

Browse and watch free-to-air channels from Zimbabwe, South Africa, Zambia,
Botswana, Kenya, and the UK, sourced live
from the [iptv-org/iptv](https://github.com/iptv-org/iptv) playlist.

## Run it

No build step, no dependencies to install. Serve the folder with any
static file server, for example:

    python -m http.server 8080

or:

    npx serve .

Then open http://localhost:8080 in a browser.

## Android

Build the Android app with the Gradle wrapper:

    .\gradlew.bat :android:assembleDebug

The Android app loads the same local player UI and fetches public playlist data
at runtime. HTTP streams are allowed because some public IPTV sources still use
cleartext URLs.

## M3U Playlists

Main combined playlist for TiviMate/VLC:

    https://raw.githubusercontent.com/AshtonLG3/iptv-player/refs/heads/master/playlists/english-africa-uk-us-verified.m3u

Sports-only playlist:

    https://raw.githubusercontent.com/AshtonLG3/iptv-player/refs/heads/master/playlists/sports-africa-uk-us-verified.m3u

## Website hosting

The static app can be hosted as-is. The browser player loads the local curated
main playlist from `playlists/english-africa-uk-us-verified.m3u`, and the menu
includes direct M3U links, copy/share actions, Android app handoff, and links
for compatible players such as VLC and TiviMate.

Browser playback uses HLS.js where possible. VLC/TiviMate will still be more
reliable for streams that fail browser CORS, referrer, geo, or DRM checks.
When hosting outside GitHub, serve `.m3u` as `audio/x-mpegurl` or
`application/vnd.apple.mpegurl` so mobile browsers have a better chance of
offering compatible player apps.

On Android/WebView, the player tries native HLS before HLS.js. This avoids some
`manifestLoadError` failures on streams that block browser JavaScript manifest
fetches but still play through the device media stack.

## Playlist maintenance

The source of truth is `playlists/channels.json`. Edit that file, then rebuild:

    npm run playlists:generate

Check that the generated `.m3u` files still match the registry:

    npm run playlists:generate:check

Verify stream health and policy rules:

    npm run playlists:verify -- --report playlist-health-report.md --json playlist-health-report.json

Track repeated failures locally while verifying:

    npm run playlists:verify -- --update-health

The verifier only reports health. It never removes or blocks a channel, and a
later healthy response resets that channel's consecutive failure count.

Create a dated restore snapshot before risky refreshes:

    npm run playlists:archive

## Official fallbacks

The in-app channel list is still sourced from public `iptv-org` streams, but
geo-blocked entries are hidden by default and the menu includes official legal
fallbacks for services such as SABC+, eVOD/e.tv, Afree TV, Z+/ZBC, ZBC YouTube,
SABC Sport, and Openview.

## Run the tests

Requires Node 18+.

    npm test
