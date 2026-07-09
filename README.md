# FTA IPTV Player

Browse and watch free-to-air channels from Zimbabwe, South Africa, Zambia,
Botswana, Kenya, and the UK, sourced live
from the [iptv-org/iptv](https://github.com/iptv-org/iptv) playlist.

## Run it

No build step, no dependencies to install. Serve the folder with any
static file server, for example:

    python -m http.server 8080

or:

    npx serve .

Then open http://localhost:8080 in a browser.

## Android

Build the Android app with the Gradle wrapper:

    .\gradlew.bat :android:assembleDebug

The Android app loads the same local player UI and fetches public playlist data
at runtime. HTTP streams are allowed because some public IPTV sources still use
cleartext URLs.

## Run the tests

Requires Node 18+.

    npm test
