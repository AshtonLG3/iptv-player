# Regional stream check — 2026-10-05

Release 1.6.26. Tests run from South Africa; availability elsewhere can differ.

- Added Great Commission TV (Kenya), from its official player at https://theiammediaministries.com/tv/. Its HLS manifest and media segment passed, FFmpeg decoded five seconds of video, and a captured frame showed the Great Commission branding. Upstream identifies English and Swahili programming.
- Rechecked Akili Kids!, K24, Capuchin TV, MERU TV, Morning Cloud TV and YOUNIB Media TV: manifests and media segments passed. Added the passing 480p Morning Cloud source as a backup.
- Disabled Inooro's expired direct URL after repeated manifest 404 responses.
- Disabled both old Willow Sports CloudFront entries after repeated media-segment 403 responses, even when manifests returned 200. Fire TV, SportsTribal and YuppTV distributor feeds returned manifest 403; the public Ayna Willow alternatives returned 403/404. No working direct Willow stream was established. Added a clearly labelled official subscription service shortcut. Free Willow Sports and subscription Willow TV are different offerings.
- Zambia: ZNBC's official TV1 iframe points to https://qtvlive.b-cdn.net/hls/znbc1-channel-stream.m3u8, which returned 403 with and without the broadcaster referrer. Fifteen archived distributor feeds also returned 403. No direct Zambian stream was added. Added the official ZNBC YouTube streams link found on https://znbc.co.zm/. Live availability follows its schedule and was not verified.
- Malawi: https://mbc.mw/live/tv1.html and tv2.html currently reference feeds returning 404. An alternate MBC SSH101 endpoint has an expired TLS certificate. The archived MBC distributor endpoint returned 403. No direct Malawian stream was added. Added the official MBC Plus Android app shortcut; app playback was not verified.
- Malawi is now included in the country selector. Dark/light themes and menu app version are retained.

Official MBC Plus listing: https://play.google.com/store/apps/details?id=com.mbc.mbcplus
Official Willow service: https://www.willow.tv/
