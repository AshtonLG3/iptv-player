# Rugare TV 1.6.44

Android version code 71.

- Re-enabled SABC 1 and SABC 2. SABC 1, 2, 3, News and Lehae now play SABC's official 1080p rendition directly, with its 720p rendition as backup; the 240p/360p renditions are no longer used.
- Android playback now opens each channel on its highest rendition instead of starting at 480p and climbing (TOP BARCA previously spent about 18 seconds at 480p). Outside Data saver, renditions below 720p are not chosen when a channel offers 720p or better, so 1080p is used where available and 720p is the fallback.
- Removed the "[Geo-blocked]" name labels, the Hide geo-blocked setting and the Geo-blocked badge. Whether a stream is region-restricted is now determined at playback: a refused stream shows the existing "restricted by its provider" message.
- Fixed the white screen shown briefly when the Android app launches; the first frame is now dark.
- Subtitle and closed-caption tracks are disabled in the inline Android player, the fallback Android player and the web player. Subtitles burned into the video by the broadcaster (for example on some SABC dramas) cannot be removed by any player.
- Newly added channels (iptv-org refresh and NeoTV+ import) must offer 720p or better, with 1080p sources placed first. Existing catalogue entries are unchanged.

Dark/light themes and the menu version are retained.

Verification: 120 automated tests pass and generated playlists match the registry. All ten SABC renditions decoded at 1920x1080 or 1280x720 from South Africa. On the Smart TV Pro, a debug build played SABC 2, SABC 3, SABC News and SABC Lehae to first frame at 1920x1080, and SABC 1 was observed playing full-screen at 1080p. After the startup-quality change, TOP BARCA, SABC 3 and Travel 4K reported 1920x1080 as their first video size and CGTN (a single 720p stream) 1280x720; launch frames no longer include a white screen.
