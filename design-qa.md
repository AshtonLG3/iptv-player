# Rugare TV in-app browser header QA

## Visual truth and rendered evidence

- Source visual truth: `C:\Users\mangezi\iptv-player\.codex-remote-attachments\019fad02-aaf9-7db1-884c-85cee43f5e00\b865aa2f-f4df-41d4-9b8a-7858221469ee\1-Photo-1.jpg` and `2-Photo-2.jpg` (592 x 1280 px each).
- Intended implementation capture: connected Samsung SM-A165F in portrait at 945 x 2048 device pixels.
- Implementation screenshot: blocked because the phone disconnected from Wireless debugging after the APK build and before installation.
- State: official SABC+ or Z+ page opened from the Rugare TV portrait service row.
- Density normalization: the 945 x 2048 device capture will be normalized to 592 x 1280 for the combined comparison.

## Full-view comparison

- Source evidence shows the custom browser controls sharing the status-bar region, producing a crowded row of oversized back, forward, reload, title, share, and close controls.
- The implementation replaces that row with a 48 dp safe-area-aware header containing only `Done`, the centered page title, and `Open`.
- Visual comparison is pending an installed-device capture.

## Focused-region comparison

- Required focus region: the status bar and app-owned browser header at the top of the official-service page.
- The implementation capture is not available, so the top-region comparison cannot yet pass.

## Required fidelity surfaces

- Fonts and typography: implemented with Android sans, 15 dp bold actions and a 16 dp bold single-line title; visual confirmation pending.
- Spacing and layout rhythm: implemented at 48 dp with equal-width actions and status-bar inset padding; visual confirmation pending.
- Colors and visual tokens: uses the existing dark Rugare TV system-bar color, white title, and blue actions; visual confirmation pending.
- Image quality and asset fidelity: no image assets are added or changed by this header refinement.
- Copy and content: controls are reduced to `Done`, the live page title, and `Open`.

## Interaction and runtime checks

- Automated tests: 48 passed.
- Android debug assembly: passed.
- Device installation and interaction checks: blocked by the disconnected SM-A165F.

## Comparison history

1. P1 source finding: six app-owned controls collide visually with Android status indicators and dominate the page header.
2. Fix implemented: removed forward, reload, share, and oversized icon buttons; retained an explicit exit and external-open path with Android Back handling page history.
3. Fix implemented: applied the status-bar inset so app-owned content no longer draws under system indicators.
4. Post-fix evidence: pending device reconnection and capture.

## Findings

- P1: visual verification is incomplete because the rebuilt APK could not be installed after Wireless debugging disconnected.

## Implementation checklist

- Reconnect the SM-A165F.
- Install the rebuilt APK.
- Open one official service and capture the portrait header.
- Create the normalized combined comparison and resolve any remaining P0/P1/P2 differences.

final result: blocked
