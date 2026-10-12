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

Menu → TV & Sports Apps includes official provider links with visible regional/access labels. Android opens installed HBO Max, Sky Sports, FanCode and TSN apps, or their verified Google Play listings when absent. FanCode prefers its TV package on Android TV. beIN opens its official country selector; A Sports opens its official website. Cricfy is excluded. No private-source import or subscription playback claim is made.

Official references:
- https://help.hbomax.com/gb-en/Answer/Detail/000002560
- https://connect.beinsports.com/
- https://www.skysports.com/watch/sky-sports-cricket
- https://www.fancode.com/in/faq
- https://www.tsn.ca/subscribe
- https://a-sports.tv/

Subscription playback for these providers is not verified. A Sports is an official website link, not a verified continuous player. Dark/light themes and app version remain in Settings.
