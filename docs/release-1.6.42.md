# Rugare TV 1.6.42

Android version code 69.

- Removed all 12 30A channels from the catalogue. The title exclusion is retained for future English playlist refreshes.
- Withdrew the SABC 1/2 direct feeds after repeated user-reported geo-blocked playback. They remain disabled during future refreshes; the existing official SABC+ shortcut is retained. SABC 3 and SABC News remain available.
- Added a saved global channel quality preference: Auto, Highest available, up to 1080p, up to 720p, and Data saver (up to 480p). Changing the preference restarts the current channel and applies it to subsequent channels and app launches.
- Highest available prioritizes higher-resolution alternate sources and selects the highest supported native Android/HLS rendition. Resolution limits prefer matching sources and retain fallback sources when unavailable. Auto preserves adaptive playback; returning to Auto resets the manual selection.
- Higher quality uses more data and can buffer on a slow connection. A quality setting cannot create a higher resolution for an SD-only feed. Official-service apps retain their own quality controls. Native browser playback without HLS.js may retain its automatic selection.
- TV focus highlights follow the actual focused control, including focus moved by the native Android remote bridge after touch input. Browser keyboard-only focus heuristics no longer hide the TV highlight.

Dark/light themes and the menu version are retained. The release advances from the already published immutable v1.6.41 artifact.

Automated verification covers source ordering, unsorted renditions, low-only fallback, invalid preference recovery, HLS quality selection and reset to Auto.

Physical TV verification: the Smart TV Pro at the user-supplied ADB address installed code 69 over v1.6.40. The five quality options were visible, D-pad/OK selected Highest available, and the setting survived force-stop/relaunch. Native playback logged `quality=high` and rendered Africa 24 Sport at 1920x1080. The final focus correction was rebuilt, signed and installed; successive D-pad movements visibly moved the white highlight between Best of Dance TV and Bellator MMA while video played.
