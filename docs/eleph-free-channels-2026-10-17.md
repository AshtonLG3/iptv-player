# Eleph free-channel audit

Report version 1.0.0. Rugare release 1.6.41 (Android code 68).

Search now treats accented and plain letters equivalently: `Barca` finds `TOP BARÇA English`. Previously lowercasing alone left that query unmatched. A regression test covers plain, accented, uppercase and surrounding-space queries.

The connected Samsung phone initially ran Rugare 1.6.39 (code 66), while GitHub offered 1.6.40. An entry in the repository did not establish that the user's installed catalogue contained it. Earlier claims that Barca was available to the user were inadequately verified.

Eleph mobile 1.0.3 (com.africa.elephtvmob) was opened on that phone. Its Free Live list contains NAT GEO WILD, SABC 1, SABC 3, SABC News, E.TV, ENCA, M-Net Movies + and M-Net Legends. Further visible entries include STAR LIFE, KYKNET & KIE and CARTOON NETWORK. E.TV rendered animation and SABC 3 rendered a concert with S3 and DW logos. Those observations establish playback inside Eleph, not portable URLs for Rugare.

| Channel | Rugare result |
| --- | --- |
| SABC 3 / S3 | Added public SABC/Mangomolo HLS to the main catalogue. Manifest, segment and 20-second video/audio decode passed from South Africa. Regional and programme restrictions may apply. Official fallback: https://sabc-plus.com/live/322. |
| TOP BARÇA English | Retained in main and Sports playlists. FC Barcelona's free FAST channel; archive matches and club programmes, not live first-team subscription coverage. |
| SABC 1, SABC News | Existing entries; current manifest and segment probes passed. |
| SABC 2, SABC Lehae | Existing entries; current manifest and segment probes also passed. |
| Nat Geo Wild | Existing India English SD feed; this audit does not claim its playback was freshly verified. |
| E.TV, ENCA, M-Net Movies +, M-Net Legends | No portable feed recovered from the inspected normal UI or player logs. Not added as nonfunctional placeholders. Existing e+ / eVOD shortcut remains available for e.tv's official service. This is an unresolved source requirement, not proof these channels cannot be added. |

The current public IPTV South Africa playlist did not supply the missing E.TV entertainment, eNCA or M-Net feeds. Its separate e.tv News & Sport entry failed its network probe and is not a substitute for E.TV.

The signed release installed over the phone's existing app, preserving settings. SABC 3 rendered changing S3/DW programming in Rugare for about 104 seconds before switching away; native logs reported first frame and playing, with adaptive resolutions including 1920x1080. TOP BARÇA was located through All Channels search and rendered an archive football match in Rugare for approximately 125 seconds, with changing frames in captures and no intervening player error/buffering event in the captured native log. The adaptive stream reached 1920x1080. These observations concern this phone and network, not every TV or region. The subsequent search-only change was rebuilt and signed for the final APK.

Both requests to the hosted /tv/update.json and Sports playlist returned HTML hosting error content instead of their intended JSON/M3U, despite HTTP 200. A successful GitHub release or site upload must not be described as repaired hosted playback.

Local evidence is retained under .codex-remote-attachments/eleph-audit and excluded from the commit. No private app data, account tokens or DRM material were extracted.
