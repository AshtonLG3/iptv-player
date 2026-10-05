# Android TV run: Rugare TV 1.6.27

Date: 2026-10-05. Device: TCL Smart TV Pro / BeyondTV4, Android 11, 1920 x 1080. Signed release installed over the existing app; package reports version 1.6.27, code 54.

| Check | Result |
| --- | --- |
| Cold launch and native live playback | Passed. TV BRICS produced decoded frames; Great Commission TV displayed moving video and broadcaster branding. |
| D-pad, OK, Back and Menu | Passed through channel list, categories, service buttons and settings. |
| Favorites | Added and removed a test favorite using Right and OK; Favorites category responded. |
| Country filter | Kenya displays seven grouped channels. Great Commission TV selected and played on the TV. Zambia and Malawi still display zero direct channels. |
| Themes and app version | Light and dark selectable; returned to dark. Version visible in the drawer/menu. |
| Playback quality | Data saver and Auto selectable; returned to Auto. Selecting quality retunes the channel and closes settings. |
| Pause/resume and channel keys | Passed. Media session reports paused state; native player returned to playing/ready. Channel Up selected K24, Channel Down returned to Great Commission TV. |
| XMLTV guide | US Pluto starter URL downloaded through Android and loaded 427 guide channels. This does not imply guide coverage for unrelated broadcasters. |
| Original service buttons | AfreeTV web page, eVOD native app and SABC+ native app opened. Z+ web catalog opened and its News 24 selection routed to the native HLS player. Full playback of these four services was not certified. |
| SportyTV | Official website showed a region restriction. Installed official Android TV app `com.sporty.android.tv` 1.10.0. Rugare's SportyTV button launched it directly. 24/7 TV reported the Real Madrid football replay; video decoder initialized at 854 x 480 and stereo audio started. User confirmed **picture and sound work** on the physical TV. ADB video capture returned black, so screenshot alone was not used as proof. |
| Extra shortcuts | Only the original AfreeTV, eVOD, SABC+, Z+ and SportyTV buttons remain featured. Added Willow paid, ZNBC YouTube and MBC Plus buttons removed. |
| Search | Existing TV interface hides search; country/category navigation was exercised instead. |
| Settings layout | Fixed grid rows shrinking around theme/quality selectors. Final installed build screenshot shows labels separated from controls. |

Validation: 105 JavaScript tests and 10 Android unit tests passed; playlist generation check and signed release build passed. APK signature verified with the existing release certificate. Device evidence is retained locally under ignored `build/tv-run/`.

Scope: representative end-to-end TV functions, not a playback certification of all 1,137 catalog channels. Willow, Zambian and Malawian direct-feed limitations remain as documented in `playlists/regional-stream-audit.md`. Intermittent wireless ADB transfers were retried; they are not counted as app playback failures.
