# Cricfy TV resource audit

Report version **1.0.0**. Observed **16 October 2026**, Africa/Johannesburg. This is a resource inventory, not an application release.

The connected Android TV runs `com.cricfytv.sports`, version **7.1**, code **51**. I opened Cricfy and inspected Categories → Sports, provider choosers, the TNT player, search, menu and Playlists. The app's banner advertises v7.3; no upgrade was installed.

## Requested providers

These are the choices actually observed in Cricfy, not portable feed URLs. Some choosers may contain additional entries; the inventory does not claim exhaustive enumeration.

| Requested provider | Observed choices |
| --- | --- |
| TNT Sports | TNT 1, 2, 3, 4 and MX, labelled AQ |
| Barça | The user supplied a phone screenshot showing a BARÇA TV tile near Combate/PFL and explained it appears intermittently among suggestions after opening other folders/channels. Not yet located on this TV. Searches for `Barca` and `Bar` in Sports returned no names. The user ruled out both unlabelled cards. This does not establish that Barça is absent from Cricfy. |
| beIN Sports | 1, 2, 3, 1 AU, 2 AU, Xtra and ENGLISH 1 |
| DAZN | Fast, RISE, Combat and Ringside, labelled AQ |
| Willow | WILLOW HD, INDIA IP, WILLOW AQ and WILLOW EX |
| Sky Sports Cricket | HD1 and HD2 |
| FanCode | FANCODE 1/2 HD, FC 1/2 AQ and FC 1/2 HD |
| Ten Sports tile | PK SPORTS and TEN CRICKET |
| TSN | TSN AQ1–AQ5 |
| Premier Sports | PREMIER SPORTS 1/2 and Premier Sports 1/2 (2), labelled AQ |

Barça follow-up: the TV Sports list was also scrolled to its bottom and Eurosport was opened to reproduce the user's reference context. The TV player remained full-screen and did not expose the phone's suggestion grid. The discovery route is recorded as user-reported; Barça identity, launch target and source remain unresolved on this TV.

The user confirmed **TNT 1 video was playing on the physical TV** while screen captures appeared black. The media session also reported a playing state, but this does not independently establish rendered video or sustained playback. No extended stall test was performed. Other providers' playback was not verified in this pass. AQ/HD are Cricfy's labels, not measured quality.

## Resources gathered and import boundary

- [Machine-readable inventory](cricfy-tv-resources-2026-10-16.json) records provider choices, evidence hashes, existing Rugare catalog matches, and explicit null values for unrecovered URLs/deep links.
- Physical-device screenshots and UI hierarchies are retained locally in `.codex-remote-attachments/cricfy-tv-audit-20261016/`. The full working capture set is in this Codex task's `tv-cricfy-audit` folder. Captures are not committed to Git.
- Normal launch component: `com.cricfytv.sports/com.android.vending.activities.Splash`. This opens Cricfy; it is not a provider-specific official-app shortcut.
- The inspected menu offered Network Stream and Playlists. Playlists displayed **No Playlists Found**. This was not an export of the bundled sports catalog.
- Package-name inspection found Cricfy but no separately installed packages matching the requested providers' names. Different package names could escape that filter; this is not a complete application-store search.

**No new portable stream URL or provider-specific app deep link was recovered from the inspected UI, media-session metadata or filtered normal player logs.** No app-private files, session credentials or DRM material were extracted. No channels, playlists, official-app shortcuts or application code were changed.

DAZN Combat is already a named entry in the existing Rugare catalog, but is not evidence of full DAZN subscription access. The same distinction applies to beIN SPORTS XTRA. Existing catalog references in the JSON are inventory observations, not fresh playback checks.

For an import, each candidate still needs an actual supported source URL or documented official-app integration, followed by playback in Rugare and a sustained stall check. A chooser label or successful Cricfy playback alone does not supply those resources.
