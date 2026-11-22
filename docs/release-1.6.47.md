# Rugare TV 1.6.47

Android version code 75.

Ordinary Back navigation never accumulates an exit count. Two complete menu cycles return to playback without exiting. Two deliberate Back presses within 600 milliseconds still exit; held-key repeats do not.

TV menus, the OK/favorite prompt and the programme guide close after ten seconds without interaction. Remote navigation, pointer activity and typing restart the timeout; active text composition is protected. Merely focusing a text field does not disable the timeout. Moving focus or closing a panel clears composition protection even when the keyboard omits its end event. Dismissal returns focus to playback and clears the channel-name banner. Returning from the background starts a fresh timeout.

SABC 1, 2 and 3 direct-feed access was checked on 22 November 2026. The configured renditions and master playlists returned HTTP 403 with a region-unavailable response from the computer connection. Fresh channel selection on the existing physical-TV v1.6.46 installation rendered all three channels with matching playing-state metadata. Existing feed URLs are retained; no feed repair or universal availability is claimed. The error screen directs viewers to the existing official SABC+ fallback, where regional restrictions and sign-in requirements may still apply.

Dark/light themes, the global quality preference and the menu version remain available.
