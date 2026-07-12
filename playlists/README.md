# Curated IPTV and OTT Sources

## Playable M3U

- `english-africa-uk-us-verified.m3u`
  - Source: `iptv-org` public playlist and streams database.
  - Focus: English-speaking African countries, UK, and USA.
  - Generated: 2026-07-12. Last updated: 2026-07-12.
  - Verification: each URL responded during the original generation. Entries
    added in the 2026-07-12 update come from the iptv-org streams database
    (which is continuously health-checked upstream) but could not be
    re-verified from the update environment because its network egress is
    restricted; report any dead entries and they will be swapped or removed.
  - Excluded: entries marked `Not 24/7`, and `Geo-blocked` entries **except**
    the SABC channels described below.

### South Africa: SABC channels ([ZA IP only])

SABC 1, SABC 2, SABC News, and SABC Lehae have public HLS feeds on SABC's own
CDN (`*.cdn.mangomolo.com`), but they are geo-locked to South African IP
addresses. They are included in the playlist tagged `[ZA IP only]` — from
inside South Africa they play in VLC/TiviMate; from anywhere else they will
error. SABC 3 has no public HLS feed; it is only on SABC+ (DRM).

### eTV and ZBC/ZTV: why they are not in the M3U

- **e.tv / eNCA**: live streams exist only inside eVOD
  (https://watch.evod.co.za/live-tv) and are DRM-protected (Widevine). There
  is no plain HLS URL that a generic M3U player can open, and stripping DRM is
  not something this playlist will do. Watch via the eVOD app/site.
- **ZBC / ZTV (Zimbabwe)**: carried on the Z+ platform
  (https://zbc.ottplatform.com/) and on ZBC's YouTube live streams
  (https://www.youtube.com/@zbcentertainment/streams). Neither is a raw HLS
  feed: Z+ is app-gated and YouTube URLs do not play in standard M3U players
  (TiviMate/VLC need a plain stream URL). The only zw entry in iptv-org
  (Yadah TV) is flagged `Not 24/7`, so it was left out.

### Sky channels

Public M3U playlists offering the full Sky lineup (Sky Sports, Sky Atlantic,
Sky Cinema, etc.) are unauthorized restreams of pay TV — they break
constantly, and they are not included here on purpose. What is included:

- **Sky News Weather** — Sky's own free CDN feed (already in the playlist).
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

- 2026-07-12: added South Africa block (SABC 1 / SABC 2 / SABC News /
  SABC Lehae `[ZA IP only]`, GNF TV, Homebase TV, Redemption TV Ministry) and
  UK official free feeds (GB News, Bloomberg TV Europe, FIFA+, GREAT! movies,
  GREAT! romance, Pop, Tiny Pop, TBN UK, QVC UK, Space Live powered by sen).
