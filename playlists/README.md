# Curated IPTV and OTT Sources

## Playable M3U

- `english-africa-uk-us-verified.m3u`
  - Source: `iptv-org` public playlist and streams database, plus selected
    responding channels from WirelessHack-listed DistroTV, Xiaomi, Vidaa, and
    Rakuten UK playlists.
  - Focus: English-language channels from English-speaking African countries,
    UK, USA, plus verified English FAST/cue-sports channels.
  - Generated: 2026-07-12. Last updated: 2026-07-21.
  - Current result: 169 entries.
  - Verification: original base entries responded during their generation.
    The 2026-07-20 sports additions responded during the sports refresh.
    WirelessHack-listed additions, Al Jazeera English, and France 24 English
    responded on 2026-07-21.
    SABC News and SABC Lehae responded directly on 2026-07-21.
  - Excluded: dead/non-responding entries, buffering entries, geo-locked
    entries, religious channels, FIFA/FIFA+ channels, local Wazobia Max
    variants, and obvious non-English variants.
  - Folders: reduced to `Africa`, `UK`, `USA`, `Sports`, `Cue Sports`, and
    `International`.
  - Use this as the main TiviMate/VLC playlist.
- `sports-africa-uk-us-verified.m3u`
  - Source: `https://iptv-org.github.io/iptv/categories/sports.m3u`.
  - Focus: English-language sports channels for English-speaking African
    countries, UK, USA, plus verified English billiards.
  - Generated: 2026-07-20.
  - Verification: each included URL responded during generation.
  - Excluded: entries that did not respond during generation, plus
    FIFA/FIFA+ channels, religious channels, geo-locked entries, and obvious
    non-English variants.
  - Current result: 74 entries.
  - Country coverage: the source had verified UK/USA entries only; no English-speaking African-country sports streams were present.

This is still a public-stream playlist. It is suitable for VLC or TiviMate, but
it should be refreshed periodically because public broadcaster URLs can change.
The `categories/sports.m3u` source is live-channel only; it does not include
VOD entries.

The website player loads the main curated playlist directly from this folder.
On mobile, the player page can share/copy the M3U URL or hand it to an Android
app chooser; if no compatible app is installed, use VLC or TiviMate.

## Maintenance and Restore

`channels.json` is the curated source of truth. The `.m3u` files are generated
from it, so a broken manual edit can be repaired with:

```powershell
npm run playlists:generate
```

Useful checks:

```powershell
npm run playlists:generate:check
npm run playlists:verify -- --report playlist-health-report.md --json playlist-health-report.json
npm run playlists:verify -- --update-health
```

Before a large refresh, create a dated snapshot:

```powershell
npm run playlists:archive
```

The verifier flags dead links, repeated failures, redirects, backup candidates,
unexpected folders, religious channels, non-English regional feeds, geo-lock
labels, SABC 1/2/3, and ABC/CBS metro variants. A weekly GitHub Action runs the
same checks, keeps failure history, and opens or updates a `playlist-health`
issue if something needs work.

The Action is report-only. It never disables or removes channels automatically,
and a stream that later returns a valid 200 playlist resets its consecutive
failure count back to zero.

### South Africa: SABC channels

SABC News and SABC Lehae have public HLS feeds on SABC's own CDN
(`*.cdn.mangomolo.com`) and were restored to the playable M3U on 2026-07-21
after direct HLS verification. SABC 1, 2, and 3 remain excluded because those
channels are geo-locked/DRM-only in the public-stream context.

### eTV and ZBC/ZTV: why they are not in the M3U

- **e.tv / eNCA**: live streams exist only inside eVOD
  (https://watch.evod.co.za/live-tv) and are DRM-protected (Widevine). There
  is no plain HLS URL that a generic M3U player can open, and stripping DRM is
  not something this playlist will do. Watch via the eVOD app/site.
- **ZBC / ZTV (Zimbabwe)**: carried on the Z+ platform
  (https://zbc.ottplatform.com/) and on ZBC's YouTube live streams
  (https://www.youtube.com/@zbcentertainment/streams). Neither is a raw HLS
  feed: Z+ is app-gated and YouTube URLs do not play in standard M3U players
  (TiviMate/VLC need a plain stream URL).

### Zimbabwe, Zambia, Botswana: what exists

Both major community stream databases (iptv-org and Free-TV) were checked on
2026-07-12:

- **Zimbabwe**: exactly one public stream exists -- Yadah TV, flagged
  `Not 24/7`. It was removed on 2026-07-21 because the current playlist
  excludes religious channels. ZBC/ZTV: see above (Z+ app or YouTube only).
- **Zambia**: zero public streams in either database. ZNBC and the private
  channels (Diamond TV, KBN TV, etc.) stream via their own sites, apps, and
  YouTube live channels -- none expose a plain HLS URL.
- **Botswana**: zero public streams in either database. Btv/DBS is
  app/YouTube only.

This is a supply problem, not a playlist problem: if a working public feed
for these countries appears upstream, it can be added on the next refresh.

### Sky channels

Public M3U playlists offering the full Sky lineup (Sky Sports, Sky Atlantic,
Sky Cinema, etc.) are unauthorized restreams of pay TV -- they break
constantly, and they are not included here on purpose. What is included:

- **Sky News Weather** -- Sky's own free CDN feed (already in the playlist).
- **Sky News** (main channel) has no stable public HLS feed in iptv-org;
  watch it free and legally on Sky News' YouTube channel or news.sky.com.

## OTT and App Sources

These are more stable legal sources, but they are not raw M3U feeds and should
be opened in their official apps or sites.

- SABC+: https://sabc-plus.com/ (includes SABC 3, DRM)
- eVOD / e.tv: https://watch.evod.co.za/live-tv
- Z+ / ZBC: https://zbc.ottplatform.com/
- ZBC YouTube live streams: https://www.youtube.com/@zbcentertainment/streams
- Afree TV: https://afreetv.net/
- Openview: https://www.openview.co.za/

## Update log

- 2026-07-21 (hosting update): updated the web player to load the curated main
  M3U by default and added menu actions for opening, copying, sharing, or
  handing the playlist to compatible Android apps. Added a direct Z+ / ZBC
  shortcut in the playlist links menu.
- 2026-07-21 (6th update): removed OTV, Resurrection TV, News Central, BCS
  StarCross TV, Bride TV, Qausain TV, Salvation TV, Sunna TV, Synagogue TV,
  all Wazobia Max local variants, ROV TV, GNF TV, and Homebase TV. Documented
  that health checks are report-only and do not permanently block streams that
  later recover. Result: 169 main entries and 74 sports-only entries.
- 2026-07-21 (5th update): added `channels.json` as the curated source of
  truth plus generator, verifier, archive tooling, and a weekly GitHub Action
  that reports link/policy failures without auto-deleting channels.
- 2026-07-21 (4th update): removed Estrella News, ENT Family, Magna Vision,
  BBC Earth Greece, Channel S, and DAZN Combat. Trimmed ABC/CBS to national
  feeds only: kept ABC News Live and CBS News 24/7, removed ABC/CBS metro and
  local station variants. Restored verified SABC News and SABC Lehae. Result:
  184 main entries and 74 sports-only entries.
- 2026-07-21 (3rd update): removed remaining non-English regional entries from
  the main `UK` folder: Afghanistan International, BBC News Latin America, and
  Brit Asia TV. Added verified Al Jazeera English and France 24 English to the
  `International` folder. Result: 234 main entries and 75 sports-only entries.
- 2026-07-21 (2nd update): removed religious channels and the remaining
  geo-locked SABC entries. Added 18 verified English FAST channels from
  WirelessHack-listed no-geo/multiple-region playlists, including Billiards TV
  (EU), Sports First TV, Africanews, Bloomberg Originals, Wild Nature, and
  Autentic Travel. Reduced main playlist folders to six broad groups. Result:
  235 main entries and 75 sports-only entries.
- 2026-07-21: filtered both playable M3U files to English-language entries by
  removing obvious non-English country/feed variants. Added verified World
  Billiards TV; Billiard TV itself is present in iptv-org's English playlist
  but was not added because it returned 403/geo-blocked during verification.
  Result: 248 main entries and 68 sports-only entries.
- 2026-07-20 (3rd update): corrected the main playlist behavior. The main
  `english-africa-uk-us-verified.m3u` now keeps the 226-channel base, removes
  9 FIFA/FIFA+ entries, and adds 80 unique responding sports streams, for 297
  entries total. The separate sports playlist remains available for
  sports-only use at 83 entries after the same FIFA/FIFA+ removal.
- 2026-07-20 (2nd update): regenerated `sports-africa-uk-us-verified.m3u`
  without name-based exclusions. If a target-country stream from iptv-org's
  sports category responded, it is included. Result: 92 entries.
- 2026-07-20: added `sports-africa-uk-us-verified.m3u` from iptv-org's sports
  category. Tested 109 target-country sports candidates; 92 responded, then
  obvious premium/pay-TV mirrors were excluded, leaving 60 curated sports
  entries.
- 2026-07-12 (2nd update): removed SABC 1 and SABC 2 (dead even from a ZA
  IP; SABC News and Lehae confirmed working). Removed duplicate FIFA+ and
  NOW Rock entries. Added Yadah TV (Zimbabwe, `Not 24/7`). Documented the
  Zimbabwe/Zambia/Botswana public-stream situation.
- 2026-07-12: added South Africa block (SABC 1 / SABC 2 / SABC News /
  SABC Lehae `[ZA IP only]`, GNF TV, Homebase TV, Redemption TV Ministry) and
  UK official free feeds (GB News, Bloomberg TV Europe, FIFA+, GREAT! movies,
  GREAT! romance, Pop, Tiny Pop, TBN UK, QVC UK, Space Live powered by sen).
