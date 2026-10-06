# English and soccer source scan

Checked 2026-10-06T09:15:26.174Z. Sources:

- https://iptv-org.github.io/iptv/categories/sports.m3u
- https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8

Both lists were inspected. English selection uses exact stream/feed metadata where available, or an unambiguous main English feed. Existing USA/UK local and regional exclusions remain. Non-English soccer entries carry an explicit reviewed tag and broadcaster evidence; other non-English sports were not imported. Only HLS feeds that passed manifest/media probing and two seconds of video decoding were imported. Provider restrictions, CORS/HTTP browser limits, schedules and future availability still apply. This is not a guarantee that a particular fixture is broadcast.

## Added or reactivated feeds

| Channel | Selection | Source |
| --- | --- | --- |
| A Spor SD (1080p) | Soccer, any language | https://www.aspor.com.tr/ |
| Africa 24 Sport (1080p) | Soccer, any language | https://africa24tv.com/sport |
| Arryadia (720p) | Soccer, any language | https://www.snrt.ma/fr/arryadia-chabab-football |
| Canal Showsport (720p) | Soccer, any language | https://canalshowsport.com.ar/ |
| Canal+ Sport (1080p) [Geo-blocked] | Soccer, any language | http://www.canalplus.fr/pid1747-c-sport.html |
| CCTV-Storm Football (1080p) | Soccer, any language | https://tv.cctv.com/ |
| CDN Deportes (720p) [Not 24/7] | Soccer, any language | https://cdndeportes.com.do/ |
| Claro Sports (1080p) | Soccer, any language | https://www.marca.com/claro-mx/ |
| CRTV (Chile) (720p) | Soccer, any language | https://crtvchile.cl/ |
| DD Sports (720p) | Soccer, any language | https://prasarbharati.gov.in/en/dd-sports-homepage/ |
| DD Sports SD (1080p) | Soccer, any language | https://prasarbharati.gov.in/en/dd-sports-homepage/ |
| El-Heddaf TV (1080p) | Soccer, any language | https://www.elheddaf.com/ |
| ESPN 4 (1080p) | Soccer, any language | http://www.espn.com.br/ |
| ESPN (1080p) | Soccer, any language | http://www.espn.com.br/ |
| Esport3 Originals (1080p) [Not 24/7] | Soccer, any language | http://www.ccma.cat/esport3/ |
| FB TV | Soccer, any language | https://www.fenerbahce.org/fbtv/ |
| FIFA+ French (720p) | Soccer, any language | https://www.plus.fifa.com/en/ |
| FIFA+ German (720p) | Soccer, any language | https://www.plus.fifa.com/en/ |
| FIFA+ Hispanic America (720p) | Soccer, any language | https://www.plus.fifa.com/en/ |
| FIFA+ Italy (720p) | Soccer, any language | https://www.plus.fifa.com/en/ |
| FIFA+ Portuguese (720p) | Soccer, any language | https://www.plus.fifa.com/en/ |
| FIFA+ Spain (720p) | Soccer, any language | https://www.plus.fifa.com/en/ |
| FIFA+ United States (720p) | Soccer, any language | https://www.plus.fifa.com/en/ |
| Fox Deportes (720p) | Soccer, any language | https://www.foxdeportes.com/ |
| Futbol TV (1080p) | Soccer, any language | https://futboltv.uz/ |
| FUTV | Soccer, any language | http://www.futvcr.com/ |
| ge Fast (1080p) | Soccer, any language | https://ge.globo.com/ge-fast/ao-vivo/ge-fast-assista-agora-ao-canal-com-24-horas-de-esporte.ghtml |
| Go3 Sport 1 (1080p) | Soccer, any language | https://go3.lv/live_tv/sports |
| HTSpor TV (1080p) | Soccer, any language | https://www.htspor.com/canli-yayin |
| Inter TV (Italy) (1080p) | Soccer, any language | https://www.inter.it/it/intertv |
| L1 Max (1080p) | Soccer, any language | https://www.l1max.com/ |
| MadeinBO TV (1080p) | Soccer, any language | https://www.madeinbo.tv/ |
| Match4 (1080p) | Soccer, any language | https://qqrq.network4.hu/press/match4-a-tarr-kft-nel-is |
| Meridiano TV (576p) | Soccer, any language | https://meridiano.net/ |
| Okko Futbol (1080p) | Soccer, any language | https://help.okko.tv/sport/sports |
| Ovacion TV (720p) [Not 24/7] | Soccer, any language | https://ovacion.pe/ |
| QazSport (1080p) | Soccer, any language | https://qazsporttv.kz/ |
| Real Madrid TV (726p) | Soccer, any language | https://www.realmadrid.com/real-madrid-tv |
| Setanta Sports 1 HD | Soccer, any language | https://www.setantaeurasia.com/ru/ |
| Setanta Sports 1 Eurasia (1080p) | Soccer, any language | https://www.setantaeurasia.com/ |
| Setanta Sports 2 Eurasia (1080p) | Soccer, any language | https://www.setantaeurasia.com/ |
| Sport 1 (Ukraine) (576p) | Soccer, any language | https://www.poverkhnost.tv/pages/index.php?c=10 |
| Sport 1 Baltic (1080p) | Soccer, any language | https://www.poverkhnost.tv/pages/index.php?c=10&s=152 |
| Sport 2 (Ukraine) (1080p) | Soccer, any language | https://www.poverkhnost.tv/pages/index.php?c=10&s=121 |
| Sport+ Qazaqstan (1080p) | Soccer, any language | https://www.sportplustv.kz/ |
| SporTV 2 (1080p) | Soccer, any language | https://sportv.globo.com/site/futebol/nacional/futebol-nacional/ |
| SporTV 3 (1080p) | Soccer, any language | http://sportv.globo.com/ |
| SporTV (1080p) | Soccer, any language | http://sportv.globo.com/ |
| Suspilne. Sport (1080p) | Soccer, any language | https://suspilne.media/sport/ |
| Teledeporte | Soccer, any language | http://www.rtve.es/television/ |
| Ten Cricket (576p) | English |  |
| Trace Sport Stars SD | English |  |
| TVR Sport | Soccer, any language | http://sport.tvr.ro/ |
| Win Sports (1080p) | Soccer, any language | https://www.winsports.co/ |
| Jewellery Maker | English |  |
| Now 70's | English |  |
| Now 80s | English |  |
| BBC Food | English |  |
| Global News | English |  |
| Russia Today | English |  |
| Moconomy | English |  |
| USA Network (1080p) | English |  |

21 verified backup feeds were attached to existing entries. 16 candidate feeds failed video decoding and were omitted. Full audit: source-glean-audit.json. Local probe and decoding evidence: build/glean/.

Displayed after quality/language variant grouping: 54 additional channels (44 soccer, 10 English), plus 21 verified backup feeds. Rai Italia and ICI Montreal were omitted from this import because their language identity was ambiguous despite upstream English labels.

Sportitalia passed initial decoding but returned HTTP 404 on the final repeated probe and was omitted.

CNN was omitted because the supplied feed is a provider slate.
