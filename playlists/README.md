# Curated IPTV and OTT Sources

## Playable M3U

- `english-africa-uk-us-verified.m3u`
  - Source: `iptv-org` public playlist and streams database.
  - Focus: English-language channels from English-speaking African countries,
    UK, USA, plus verified English billiards.
  - Generated: 2026-07-12. Last updated: 2026-07-21.
  - Current result: 248 entries.
  - Verification: original base entries responded during their generation.
    The 2026-07-20 sports additions responded during the sports refresh.
    World Billiards TV responded on 2026-07-21.
  - Excluded: dead/non-responding entries, plus `Geo-blocked` entries
    **except** the SABC channels described below. FIFA/FIFA+ and obvious
    non-English variants were removed.
  - Use this as the main TiviMate/VLC playlist.
- `sports-africa-uk-us-verified.m3u`
  - Source: `https://iptv-org.github.io/iptv/categories/sports.m3u`.
  - Focus: English-language sports channels for English-speaking African
    countries, UK, USA, plus verified English billiards.
  - Generated: 2026-07-20.
  - Verification: each included URL responded during generation.
  - Excluded: entries that did not respond during generation, plus
    FIFA/FIFA+ channels and obvious non-English variants.
  - Current result: 68 entries.
  - Country coverage: the source had verified UK/USA entries only; no English-speaking African-country sports streams were present.

This is still a public-stream playlist. It is suitable for VLC or TiviMate, but
it should be refreshed periodically because public broadcaster URLs can change.
The `categories/sports.m3u` source is live-channel only; it does not include
VOD entries.

### South Africa: SABC channels ([ZA IP only])

SABC News and SABC Lehae have public HLS feeds on SABC's own CDN
(`*.cdn.mangomolo.com`), geo-locked to South African IP addresses. They are
included tagged `[ZA IP only]` and are confirmed working from inside South
Africa (tested 2026-07-12). SABC 1 and SABC 2 had public URLs in the same
family, but they turned out to be dead even from a ZA IP and were removed;
SABC 1, 2, and 3 are otherwise only on SABC+ (DRM).

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
  `Not 24/7`. It is now included under `Zimbabwe - Religious` as the sole zw
  entry. ZBC/ZTV: see above (Z+ app or YouTube only).
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
