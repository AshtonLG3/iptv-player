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

## Official fallbacks

The in-app channel list is still sourced from public `iptv-org` streams, but
geo-blocked entries are hidden by default and the menu includes official legal
fallbacks for services such as SABC+, eVOD/e.tv, Afree TV, Z+/ZBC, ZBC YouTube,
SABC Sport, and Openview.

## Run the tests

Requires Node 18+.

    npm test
