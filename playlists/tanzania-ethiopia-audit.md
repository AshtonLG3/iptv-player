# Tanzania and Ethiopia stream audit

Checked 2026-10-06T08:41:45.092Z. All languages accepted for these two countries.

| Country | Channel | Media probe |
| --- | --- | --- |
| et | Addis TV (720p) | fetch failed |
| et | EBS HD (1080p) | Passed |
| et | Mereja TV | fetch failed |
| et | Nesiha TV (720p) | fetch failed |
| tz | Dodoma TV (360p) [Not 24/7] | Manifest HTTP 404 |
| tz | IBN TV (480p) | Passed |
| tz | IBN TV Africa (720p) | Passed |
| tz | Mahaasin TV | Passed |
| tz | Tanzania Safari Channel (576p) | Manifest HTTP 404 |
| tz | TBC1 | fetch failed |
| tz | TBC2 (1080p) | Passed |
| tz | Urejesho TV Africa (360p) [Not 24/7] | Manifest HTTP 404 |
| et | Addis TV (720p) | fetch failed |
| et | EBS Cinema (720p) | Passed |
| et | EBS HD (1080p) | Passed |
| et | EBS Musika (720p) | Passed |
| et | Mereja TV (1080p) [Not 24/7] | Manifest HTTP 403 |
| et | Mereja TV | fetch failed |
| et | Nesiha TV (720p) | fetch failed |
| et | Nesiha TV (720p) | Passed |

Nesiha uses the working HTTPS hostname str.cantechhub.com; the old hostname has a certificate mismatch. EBS diaspora feeds retain their upstream US guide IDs and explicitly appear under Ethiopia. EBC (https://www.ebc.et/Home/Live) and Fana (https://www.fanamc.com/english/live/) currently use NovaStream session registration and signed per-segment playback URLs, so they were not added as static direct streams. No TLS validation was disabled.

All eight added feeds also passed a fresh probe and three seconds of FFmpeg video decoding. Detailed local evidence: build/regional/final-verification.json. No Android device was connected for this release.
