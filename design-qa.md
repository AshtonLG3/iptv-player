# Rugare TV in-app browser header QA

## Visual truth and rendered evidence

- Source visual truth: `C:\Users\mangezi\iptv-player\.codex-remote-attachments\019fad02-aaf9-7db1-884c-85cee43f5e00\b865aa2f-f4df-41d4-9b8a-7858221469ee\1-Photo-1.jpg` and `2-Photo-2.jpg`.
- Implementation screenshot: `C:\Users\mangezi\iptv-player\build\rugare-tv-browser-clean.png`.
- Full-view comparison: `C:\Users\mangezi\iptv-player\build\design-qa-in-app-browser-comparison.png`.
- Focused header comparison: `C:\Users\mangezi\iptv-player\build\design-qa-in-app-browser-header-comparison.png`.
- Viewport: Samsung SM-A165F in portrait, 1080 x 2340 device pixels at Android override density 480 dpi.
- Source pixels: 591 x 1280. Implementation pixels: 1080 x 2340. The implementation was downsampled to 591 x 1280 with Lanczos resampling before comparison; CSS size and browser device-scale factor are not applicable to this native Android capture.
- State: the same SABC+ programme page opened from Rugare TV's portrait official-service row.

## Findings

- No actionable P0, P1, or P2 differences remain in the app-owned header.
- The external SABC+ page changed its responsive scale and live content spacing between captures. That page is publisher-owned and is excluded from app-header fidelity findings.

## Full-view comparison

- The SABC+ page remains fully visible and scrollable below the app-owned chrome.
- The replacement header consumes one compact row and does not obscure the broadcaster's install banner or programme content.
- The status bar, header, publisher page, and Android navigation bar remain visually separated.

## Focused-region comparison

- The source shows oversized back, forward, reload, share, and close controls colliding with Android status indicators.
- The implementation shows a clean status bar followed by a 48 dp header with `Done`, a centered ellipsized live page title, and `Open`.
- The focused comparison confirms there is no overlap, clipped action text, or hidden primary control.

## Required fidelity surfaces

- Fonts and typography: Android sans is consistent with the platform; the 15 sp bold actions and 16 sp bold title remain legible, vertically centered, and correctly truncated.
- Spacing and layout rhythm: the 48 dp toolbar, balanced 64 dp minimum action widths, 8-12 dp internal padding, and applied status-bar inset produce an even compact rhythm.
- Colors and visual tokens: the existing near-black Rugare TV system-bar tone, white title, and blue actions preserve the app's dark interface and meet clear contrast expectations.
- Image quality and asset fidelity: no app-owned raster assets were added or replaced. The external SABC+ logo and programme imagery remain sharp at the captured density.
- Copy and content: `Done` clearly returns to Rugare TV, the live page title supplies context, and `Open` clearly hands the page to the device browser or installed app.

## Interaction and runtime checks

- Automated tests: 48 passed.
- Android debug assembly: passed.
- Installed package: `com.mangezi.ftaiptv`, versionName `1.5.0`, versionCode `17`, on Samsung SM-A165F over Wireless debugging.
- Opening SABC+ pauses the active WildEarth player and leaves the Rugare TV media session inactive and paused.
- `Done` closes the official-service page and returns to `MainActivity`; the player remains visibly paused.
- `Open` launches the SABC+ URL in Chrome, stops and closes the in-app service page, and Android Back returns directly to Rugare TV with the player still paused.

## Comparison history

1. P1 source finding: six app-owned controls collided visually with Android status indicators and dominated the page header.
2. Fix: replaced them with `Done`, a centered page title, and `Open`; added the status-bar inset.
3. P1 runtime finding from follow-up: the Rugare TV stream could continue underneath an official service or external app.
4. Fix: pause all main-player media and clear its native media session before opening an official service; pause and mute official-page media before external handoff, then close the wrapper.
5. Post-fix evidence: the normalized full-view and focused comparisons show a clean non-overlapping header, while device checks confirm both return paths and stopped playback.

## Implementation checklist

- [x] Remove crowded browser controls.
- [x] Respect the Android status-bar safe area.
- [x] Keep explicit close and external-open actions.
- [x] Stop playback before official-service and external-app handoffs.
- [x] Verify the header and return paths on the connected phone.

final result: passed
