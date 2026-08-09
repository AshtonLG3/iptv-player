# Rugare TV

Browse and watch free-to-air and public FAST channels from Zimbabwe, South
Africa, Zambia, Botswana, Kenya, the UK, and worldwide providers. Sources
include [iptv-org/iptv](https://github.com/iptv-org/iptv) and selected public,
ad-supported NeoTV+ sports feeds.

## Run it

No build step, no dependencies to install. Serve the folder with any
static file server, for example:

    python -m http.server 8080

or:

    npx serve .

Then open http://localhost:8080 in a browser.

## Android

The signed release APK is hosted directly by the website at:

    https://mangezi.xyz/tv/rugare-tv.apk

That URL is served by the website host and does not depend on a laptop or a
local Downloads folder being online.

Build the Android app with the Gradle wrapper:

    .\gradlew.bat :android:assembleDebug

The Android app loads the same local player UI and fetches public playlist data
at runtime. HTTP streams are allowed because some public IPTV sources still use
cleartext URLs.

Starting with v1.6.2, the Android settings menu can import a private local M3U
file up to 2 MB. The playlist is stored only in Rugare TV's private app storage;
its URLs and account details are never added to the bundled public playlist or
GitHub repository, and Android backup is disabled for this app. Choose **Use curated list** in the same menu to remove the
private import and return to Rugare TV's verified public channels. Large or
provider-specific playlists can still contain dead, unsupported, or restricted
streams, so importing a file does not guarantee that every entry will play.

Starting with v1.5.9, the Android app checks `https://mangezi.xyz/tv/update.json`
on launch and exposes **Check for updates** in its settings menu. A newer signed
APK is downloaded directly from mangezi.xyz, checked against the published
SHA-256 hash, package name, version code, and installed signing certificate,
then handed to Android's package installer. Android still requires the user to
approve installation and may request **Install unknown apps** permission for
Rugare TV the first time.

## M3U Playlists

Main combined playlist for TiviMate/VLC:

    https://raw.githubusercontent.com/AshtonLG3/iptv-player/refs/heads/master/playlists/english-africa-uk-us-verified.m3u

Sports-only playlist:

    https://raw.githubusercontent.com/AshtonLG3/iptv-player/refs/heads/master/playlists/sports-africa-uk-us-verified.m3u

## Website hosting

The static app can be hosted as-is. The browser player loads the local curated
main playlist from `playlists/english-africa-uk-us-verified.m3u`, and the menu
includes direct M3U links, copy/share actions, Android app handoff, and links
for compatible players such as VLC and TiviMate. The same menu also includes a
direct Z+ / ZBC shortcut for Zimbabwe OTT viewing.

Browser playback uses HLS.js where possible. VLC/TiviMate will still be more
reliable for streams that fail browser CORS, referrer, geo, or DRM checks.
When hosting outside GitHub, serve `.m3u` as `audio/x-mpegurl` or
`application/vnd.apple.mpegurl` so mobile browsers have a better chance of
offering compatible player apps.

On Android/WebView, the player tries native HLS before HLS.js. This avoids some
`manifestLoadError` failures on streams that block browser JavaScript manifest
fetches but still play through the device media stack.

Android TV uses a remote-first layout. Left toggles the channel list, Right or
Menu toggles settings, Up/Down moves focus one channel at a time, OK plays the
focused channel and closes the list, and Channel Up/Down switches the current
channel directly. TV playback has no persistent edge buttons or native video
control frame, and favorite buttons are kept out of TV focus navigation. In the
channel drawer, Up moves from channels to categories and then to the official
service buttons. Long channel lists stop at their ends instead of wrapping back
to the currently playing channel.

The mobile layout keeps the player first, followed by a persistent now-playing
row, conventional content filters for News, Sports, Movies, Entertainment,
Wildlife, Documentary, Kids, Music, Lifestyle, and General channels, plus
artwork-rich channel rows. Country remains a separate filter. On TV, the same
channel metadata appears in the remote drawer and as a short-lived overlay when
changing channels; normal playback remains full-screen and unobstructed.

On Android, the official SABC+, eVOD/e+, Z+, and SportyTV shortcuts open their
native apps after the channel player pauses and its media session clears. On TV,
SportyTV uses Rugare's remote-aware website fallback even when the mobile app is
installed, because its phone layout does not reliably expose scrolling to a
D-pad. It opens SportyTV's football match list directly so simultaneous live
games are immediately reachable; the 24/7 channel remains in SportyTV's bottom
navigation. TV-only apps such as SABC+ are resolved through Android's Leanback
launcher before the phone/tablet launcher. When
an app is unavailable, Rugare opens its official website in an isolated,
remote-aware fallback: the D-pad moves a visible gold focus ring or scrolls the
page, OK activates the focused item, Page/Channel Up and Down scroll, and the
Menu key reveals Done/Browsers actions. Browsers always opens Android's chooser
so installed TV browsers can be tested without changing the system default.
Remote focus survives category redraws, discovers React/JavaScript click
targets that are not normal links or buttons, and keeps nested card controls
from trapping Left/Right navigation inside one tile. OK activates cards and
menu items such as ZBC's channel banners, while page scrolling clears stale
focus so it cannot snap back. The ZBC fallback also clears the website player's
initial mute state when its media appears. The SportyTV fallback clears the
player mute state and keeps the full page browseable, so D-pad Up/Down and
Left/Right can reach concurrent live-game cards and scroll their vertical or
horizontal lists into view. OK on the video still enters fullscreen, while
channel and media keys remain available.
Its Bitmovin quality selector has a
remote adjustment mode: focus Video Quality, press OK, choose a resolution with
the D-pad, then press OK again. This TV-focused web shell avoids
depending on browsers that need a mouse to click website controls.

TV browsers that omit a normal Android TV user agent are detected after their
first remote-navigation key. Raw Android D-pad codes are normalized so TCL and
generic TV-box browsers can enter the same remote-first Rugare layout.

## Playlist maintenance

The source of truth is `playlists/channels.json`. Edit that file, then rebuild:

    npm run playlists:generate

Refresh the approved NeoTV+ sports subset and its locally hosted logos:

    npm run playlists:import:neotv-sports

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

The in-app channel list uses curated public streams. Geo-blocked general
channels are hidden by default, while Sports and Cue Sports may retain clearly
labeled region-limited feeds without attempting a proxy or geo-bypass. The menu
also includes official fallbacks such as SABC+, eVOD/e.tv, Afree TV, Z+/ZBC,
ZBC YouTube, SABC Sport, and Openview. On Android, the SABC+, eVOD/e+, Z+, and
SportyTV buttons launch their installed official apps after pausing Rugare TV,
with a remote-aware official-website fallback when the app is missing. On TV,
SportyTV always uses that fallback so simultaneous games below or beside the
main player remain reachable with the remote. It starts compatible HTML video
automatically and selects the highest quality exposed by the player. Adaptive
stream quality still depends on what SportyTV makes available and the network
connection. AfreeTV, which does
not currently expose a verified Play Store package, uses the same official-site
fallback.

## Run the tests

Requires Node 18+.

    npm test
