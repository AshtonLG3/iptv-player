# Sports source audit — 12 October 2026

Checked 145 active sports registry feeds using nested HLS manifests, encryption keys where required, and media bytes. 129 passed initially; A Spor passed on retry, leaving 15 without a reachable source from this Windows connection. These are feed entries, not 145 distinct channel brands. No decoder or every-device playback claim is made.

FIFA+ had a failed primary (HTTP 403) and a working backup. The working backup is now primary. Access-denied feeds remain listed because regional restrictions do not establish a global outage; off-air and transient failures are also retained.

| Feed | Retry result |
| --- | --- |
| Rugby Pass TV (720p) | Manifest HTTP 403 |
| Golazo Network (720p) | Manifest HTTP 403 |
| Monster Jam (720p) | Manifest HTTP 403 |
| PBR RidePass (720p) | Manifest HTTP 403 |
| PFL MMA (720p) | Manifest HTTP 403 |
| Pluto TV Competition | Manifest HTTP 403 |
| Pluto TV Snooker 900 | Manifest HTTP 403 |
| DAZN Combat (684p) | Manifest HTTP 403 |
| MLB (720p) | Manifest HTTP 403 |
| NFL Channel (720p) | Manifest HTTP 403 |
| Pluto TV Snooker 900 (Germany) GB (720p) | Manifest HTTP 403 |
| PokerGo | Manifest HTTP 403 |
| Real Madrid TV English | Manifest HTTP 503 |
| CDN Deportes (720p) [Not 24/7] | Manifest HTTP 404 |
| Ten Cricket (576p) | The operation was aborted due to timeout |

## Requested services

The attached Samsung SM-A165F had com.cricfytv.sports installed. Live TV → Sports displayed TNT, beIN, Sky Sports Cricket, FanCode, TSN, A Sports and other groups. The TNT chooser exposed TNT 1, 2, 3, 4 and MX. FOX Sports 1 and TNT 1 were visibly playing in Cricfy. This establishes playback inside Cricfy only, not portable public feed URLs.

The six newly added provider shortcuts were withdrawn at the users request because usable playback was not verified. The pre-existing service menu is restored; Cricfy is excluded.

Official references:
- https://help.hbomax.com/gb-en/Answer/Detail/000002560
- https://connect.beinsports.com/
- https://www.skysports.com/watch/sky-sports-cricket
- https://www.fancode.com/in/faq
- https://www.tsn.ca/subscribe
- https://a-sports.tv/

Subscription playback for these providers is not verified. A Sports is an official website link, not a verified continuous player. Dark/light themes and app version remain in Settings.

## Portable imports verified in Rugare

A fresh iptv-org sports catalog comparison found 17 targeted candidates absent from the registry URLs. Ten passed HLS media-byte probing, and four requested channel feeds were selected for device verification: Willow, TSN4, Star Sports 2 and Star Sports Select 1. All four rendered identifiable broadcasts in Rugare on Samsung SM-A165F, with native ready=true/playing=true events and initialized audio decoders. The first Willow attempt was paused by the fresh debug app notification-permission dialog; it passed the repeat check after that dialog closed.

Star Sports 2 and Select 1 decode at 720x576 with English-tagged MP2 audio. TSN4 decodes at 1280x720 with AC3 audio; its audio language tag says fra although the visible channel is TSN4. Commentary language was not independently audited. Willow decodes at 1280x720 with AAC audio. Device codec support can differ, and these HTTP feeds can be blocked by HTTPS browser mixed-content rules. Availability is a point-in-time result, not a guarantee.

Four entries were added to main and sports playlists in v1.6.38. No TNT, main beIN, Sky Sports Cricket or FanCode feed was verified for import in this pass. The Spanish Fox Sports candidate was excluded from this English catalog; other probe successes were duplicates or outside this requested device check. The original official-service menu is retained.
