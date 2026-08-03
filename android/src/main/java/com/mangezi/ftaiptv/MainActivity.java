package com.mangezi.ftaiptv;

import android.Manifest;
import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.UiModeManager;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.net.Uri;
import android.os.Bundle;
import android.os.Build;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.webkit.WebViewAssetLoader;
import java.net.URISyntaxException;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;

public final class MainActivity extends Activity {
    private static final String APP_ASSET_HOST = "appassets.androidplatform.net";
    private static final String MEDIA_NOTIFICATION_CHANNEL_ID = "playback";
    private static final int MEDIA_NOTIFICATION_ID = 1001;
    private static final int NOTIFICATION_PERMISSION_REQUEST = 1002;
    private static final String ACTION_PREVIOUS = "com.mangezi.ftaiptv.action.PREVIOUS";
    private static final String ACTION_NEXT = "com.mangezi.ftaiptv.action.NEXT";
    private static final String ACTION_PLAY = "com.mangezi.ftaiptv.action.PLAY";
    private static final String ACTION_PAUSE = "com.mangezi.ftaiptv.action.PAUSE";
    private static final String ACTION_TOGGLE_PLAYBACK = "com.mangezi.ftaiptv.action.TOGGLE_PLAYBACK";
    private static final String PAUSE_WEB_MEDIA_SCRIPT =
            "(function(){try{"
                    + "if(window.__ftaIptvSuspendPlayback){window.__ftaIptvSuspendPlayback();}"
                    + "else if(window.__ftaIptvPause){window.__ftaIptvPause();}"
                    + "document.querySelectorAll('video,audio').forEach(function(media){"
                    + "media.pause();media.muted=true;media.volume=0;"
                    + "});"
                    + "}catch(error){}return true;})()";
    private WebView webView;
    private MediaSession mediaSession;
    private NotificationManager notificationManager;
    private String currentTitle = "";
    private String currentArtist = "";
    private String currentArtworkUrl = "";
    private boolean currentCanNavigate;
    private boolean currentIsPlaying;
    private boolean isTelevisionDevice;
    private boolean notificationPermissionRequested;
    private boolean suppressMediaSessionUpdates;
    private float playerGestureStartX;
    private float playerGestureStartY;
    private boolean playerChannelSwipeCandidate;
    private volatile boolean tvPanelOpen;
    private volatile String tvPanelState = "none";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setTitle(getString(R.string.app_name));
        isTelevisionDevice = detectTelevisionDevice();
        createMediaSession();

        WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        webView = new WebView(this);
        webView.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            webView.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, true);
        }

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }

        webView.setWebChromeClient(new WebChromeClient());
        webView.addJavascriptInterface(new AndroidMediaBridge(), "AndroidMediaSession");
        webView.addJavascriptInterface(new AndroidDeviceBridge(), "AndroidDevice");
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handleNavigation(request.getUrl());
            }

            @SuppressWarnings("deprecation")
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleNavigation(Uri.parse(url));
            }

            private boolean handleNavigation(Uri url) {
                String scheme = url.getScheme();
                if ("intent".equals(scheme)) {
                    return openIntentUrlInApp(url.toString());
                }

                if (!("http".equals(scheme) || "https".equals(scheme))) {
                    return true;
                }

                if (APP_ASSET_HOST.equals(url.getHost())) {
                    return false;
                }

                pausePlayerThen(() -> InAppBrowserActivity.open(
                        MainActivity.this,
                        url.toString()
                ));
                return true;
            }

            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                if (view != webView) return false;

                ViewGroup parent = (ViewGroup) view.getParent();
                if (parent != null) parent.removeView(view);
                view.destroy();
                webView = null;
                tvPanelOpen = false;
                tvPanelState = "none";
                if (!isFinishing() && !isDestroyed()) {
                    getWindow().getDecorView().post(MainActivity.this::recreate);
                }
                return true;
            }
        });

        setContentView(webView);
        updateSystemUiForOrientation(getResources().getConfiguration().orientation);
        webView.loadUrl("https://appassets.androidplatform.net/assets/index.html");
    }

    private boolean detectTelevisionDevice() {
        UiModeManager uiModeManager = (UiModeManager) getSystemService(Context.UI_MODE_SERVICE);
        boolean televisionMode = uiModeManager != null
                && uiModeManager.getCurrentModeType() == Configuration.UI_MODE_TYPE_TELEVISION;
        PackageManager packageManager = getPackageManager();
        return televisionMode
                || packageManager.hasSystemFeature(PackageManager.FEATURE_LEANBACK)
                || packageManager.hasSystemFeature(PackageManager.FEATURE_TELEVISION);
    }

    private void updateSystemUiForOrientation(int orientation) {
        View decorView = getWindow().getDecorView();
        if (isTelevisionDevice || orientation == Configuration.ORIENTATION_LANDSCAPE) {
            decorView.setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            );
            return;
        }
        decorView.setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        updateSystemUiForOrientation(newConfig.orientation);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            updateSystemUiForOrientation(getResources().getConfiguration().orientation);
        }
    }

    @Override
    public boolean dispatchTouchEvent(MotionEvent event) {
        boolean revealPlayerControlsAfterDispatch = false;
        if (!isTelevisionDevice && webView != null) {
            switch (event.getActionMasked()) {
                case MotionEvent.ACTION_DOWN:
                    playerGestureStartX = event.getX();
                    playerGestureStartY = event.getY();
                    playerChannelSwipeCandidate = getResources().getConfiguration().orientation
                            == Configuration.ORIENTATION_LANDSCAPE
                            && playerGestureStartX >= webView.getWidth() * 0.70f;
                    break;
                case MotionEvent.ACTION_UP:
                    boolean openedChannelDrawer = false;
                    if (playerChannelSwipeCandidate) {
                        float density = getResources().getDisplayMetrics().density;
                        float horizontalTravel = event.getX() - playerGestureStartX;
                        float verticalTravel = Math.abs(event.getY() - playerGestureStartY);
                        if (horizontalTravel <= -72f * density && verticalTravel < 90f * density) {
                            evaluatePlayerCommand("__ftaIptvOpenChannels");
                            openedChannelDrawer = true;
                        }
                    }
                    revealPlayerControlsAfterDispatch = !openedChannelDrawer;
                    playerChannelSwipeCandidate = false;
                    break;
                case MotionEvent.ACTION_CANCEL:
                    playerChannelSwipeCandidate = false;
                    break;
                default:
                    break;
            }
        }
        boolean handled = super.dispatchTouchEvent(event);
        if (revealPlayerControlsAfterDispatch && webView != null) {
            evaluatePlayerTouch(
                    event.getX() / Math.max(1f, webView.getWidth()),
                    event.getY() / Math.max(1f, webView.getHeight())
            );
        }
        return handled;
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (!isTelevisionDevice || event.getAction() != KeyEvent.ACTION_DOWN) {
            return super.dispatchKeyEvent(event);
        }

        switch (event.getKeyCode()) {
            case KeyEvent.KEYCODE_DPAD_LEFT:
                if ("services".equals(tvPanelState)
                        || "categories".equals(tvPanelState)
                        || "playback".equals(tvPanelState)) {
                    return super.dispatchKeyEvent(event);
                }
                if ("settings".equals(tvPanelState)) {
                    evaluatePlayerCommand("__ftaIptvTvClosePanel");
                } else if ("none".equals(tvPanelState)) {
                    evaluatePlayerCommand("__ftaIptvTvLeft");
                }
                return true;
            case KeyEvent.KEYCODE_DPAD_RIGHT:
                if ("services".equals(tvPanelState)
                        || "categories".equals(tvPanelState)
                        || "playback".equals(tvPanelState)) {
                    return super.dispatchKeyEvent(event);
                }
                if ("channels".equals(tvPanelState)) {
                    evaluatePlayerCommand("__ftaIptvTvClosePanel");
                } else if ("none".equals(tvPanelState)) {
                    evaluatePlayerCommand("__ftaIptvTvRight");
                }
                return true;
            case KeyEvent.KEYCODE_MENU:
                evaluatePlayerCommand("__ftaIptvTvToggleMenu");
                return true;
            case KeyEvent.KEYCODE_CHANNEL_UP:
                evaluatePlayerCommand("__ftaIptvNextChannel");
                return true;
            case KeyEvent.KEYCODE_CHANNEL_DOWN:
                evaluatePlayerCommand("__ftaIptvPreviousChannel");
                return true;
            case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:
                handleMediaAction(ACTION_TOGGLE_PLAYBACK);
                return true;
            default:
                return super.dispatchKeyEvent(event);
        }
    }

    private void createMediaSession() {
        notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        createMediaNotificationChannel();

        mediaSession = new MediaSession(this, getString(R.string.app_name));
        mediaSession.setFlags(MediaSession.FLAG_HANDLES_MEDIA_BUTTONS
                | MediaSession.FLAG_HANDLES_TRANSPORT_CONTROLS);
        mediaSession.setCallback(new MediaSession.Callback() {
            @Override
            public void onSkipToPrevious() {
                handleMediaAction(ACTION_PREVIOUS);
            }

            @Override
            public void onSkipToNext() {
                handleMediaAction(ACTION_NEXT);
            }

            @Override
            public void onPlay() {
                handleMediaAction(ACTION_PLAY);
            }

            @Override
            public void onPause() {
                handleMediaAction(ACTION_PAUSE);
            }
        });
    }

    private void createMediaNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || notificationManager == null) return;

        NotificationChannel channel = new NotificationChannel(
                MEDIA_NOTIFICATION_CHANNEL_ID,
                "Playback",
                NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Current IPTV playback");
        channel.setShowBadge(false);
        notificationManager.createNotificationChannel(channel);
    }

    private void updateNativeMediaSession(
            String title,
            String artist,
            String artworkUrl,
            boolean canNavigate,
            boolean isPlaying
    ) {
        if (mediaSession == null) return;

        currentTitle = nonEmpty(title, getString(R.string.app_name));
        currentArtist = nonEmpty(artist, getString(R.string.app_name));
        currentArtworkUrl = nonEmpty(artworkUrl, "");
        currentCanNavigate = canNavigate;
        currentIsPlaying = isPlaying;

        MediaMetadata.Builder metadata = new MediaMetadata.Builder()
                .putString(MediaMetadata.METADATA_KEY_TITLE, currentTitle)
                .putString(MediaMetadata.METADATA_KEY_DISPLAY_TITLE, currentTitle)
                .putString(MediaMetadata.METADATA_KEY_ARTIST, currentArtist)
                .putString(MediaMetadata.METADATA_KEY_DISPLAY_SUBTITLE, currentArtist)
                .putString(MediaMetadata.METADATA_KEY_ALBUM, getString(R.string.app_name));

        if (!currentArtworkUrl.isEmpty()) {
            metadata.putString(MediaMetadata.METADATA_KEY_ART_URI, currentArtworkUrl);
            metadata.putString(MediaMetadata.METADATA_KEY_DISPLAY_ICON_URI, currentArtworkUrl);
        }

        mediaSession.setMetadata(metadata.build());
        updatePlaybackState();
        mediaSession.setActive(true);
        requestNotificationPermissionIfNeeded();
        updateMediaNotification();
    }

    private void requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
                || notificationPermissionRequested
                || checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                == PackageManager.PERMISSION_GRANTED) {
            return;
        }
        notificationPermissionRequested = true;
        requestPermissions(
                new String[]{Manifest.permission.POST_NOTIFICATIONS},
                NOTIFICATION_PERMISSION_REQUEST
        );
    }

    private void clearNativeMediaSession() {
        currentTitle = "";
        currentArtist = "";
        currentArtworkUrl = "";
        currentCanNavigate = false;
        currentIsPlaying = false;
        if (mediaSession != null) {
            updatePlaybackState();
            mediaSession.setMetadata(null);
            mediaSession.setActive(false);
        }
        if (notificationManager != null) {
            notificationManager.cancel(MEDIA_NOTIFICATION_ID);
        }
    }

    private void updatePlaybackState() {
        if (mediaSession == null) return;

        long actions = PlaybackState.ACTION_PLAY
                | PlaybackState.ACTION_PAUSE
                | PlaybackState.ACTION_PLAY_PAUSE
                | PlaybackState.ACTION_STOP;
        if (currentCanNavigate) {
            actions |= PlaybackState.ACTION_SKIP_TO_PREVIOUS | PlaybackState.ACTION_SKIP_TO_NEXT;
        }

        int state = currentIsPlaying ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED;
        PlaybackState playbackState = new PlaybackState.Builder()
                .setActions(actions)
                .setState(state, PlaybackState.PLAYBACK_POSITION_UNKNOWN, currentIsPlaying ? 1.0f : 0.0f)
                .build();
        mediaSession.setPlaybackState(playbackState);
    }

    private void updateMediaNotification() {
        if (notificationManager == null || mediaSession == null || currentTitle.isEmpty()) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
            return;
        }

        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(this, MEDIA_NOTIFICATION_CHANNEL_ID)
                : new Notification.Builder(this);

        Notification.MediaStyle mediaStyle = new Notification.MediaStyle()
                .setMediaSession(mediaSession.getSessionToken());

        int compactPlayActionIndex = currentCanNavigate ? 1 : 0;
        if (currentCanNavigate) {
            mediaStyle.setShowActionsInCompactView(0, 1, 2);
        } else {
            mediaStyle.setShowActionsInCompactView(compactPlayActionIndex);
        }

        builder.setSmallIcon(R.drawable.ic_stat_media)
                .setContentTitle(currentTitle)
                .setContentText(currentArtist)
                .setContentIntent(createLaunchPendingIntent())
                .setCategory(Notification.CATEGORY_TRANSPORT)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setOngoing(currentIsPlaying)
                .setOnlyAlertOnce(true)
                .setShowWhen(false)
                .setStyle(mediaStyle);

        if (currentCanNavigate) {
            builder.addAction(createNotificationAction(
                    android.R.drawable.ic_media_previous,
                    "Previous",
                    ACTION_PREVIOUS
            ));
        }

        builder.addAction(createNotificationAction(
                currentIsPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play,
                currentIsPlaying ? "Pause" : "Play",
                currentIsPlaying ? ACTION_PAUSE : ACTION_PLAY
        ));

        if (currentCanNavigate) {
            builder.addAction(createNotificationAction(
                    android.R.drawable.ic_media_next,
                    "Next",
                    ACTION_NEXT
            ));
        }

        try {
            notificationManager.notify(MEDIA_NOTIFICATION_ID, builder.build());
        } catch (SecurityException ignored) {
            // Active MediaSession remains available even if notifications are blocked by the device.
        }
    }

    private Notification.Action createNotificationAction(int icon, String title, String action) {
        return new Notification.Action.Builder(icon, title, createMediaActionPendingIntent(action)).build();
    }

    private PendingIntent createLaunchPendingIntent() {
        Intent intent = new Intent(this, MainActivity.class);
        intent.setAction(Intent.ACTION_MAIN);
        intent.addCategory(Intent.CATEGORY_LAUNCHER);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(this, 0, intent, pendingIntentFlags());
    }

    private PendingIntent createMediaActionPendingIntent(String action) {
        Intent intent = new Intent(this, MainActivity.class);
        intent.setAction(action);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(this, action.hashCode(), intent, pendingIntentFlags());
    }

    private int pendingIntentFlags() {
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return flags;
    }

    private boolean handleMediaAction(String action) {
        if (action == null) return false;

        switch (action) {
            case ACTION_PREVIOUS:
                evaluatePlayerCommand("__ftaIptvPreviousChannel");
                return true;
            case ACTION_NEXT:
                evaluatePlayerCommand("__ftaIptvNextChannel");
                return true;
            case ACTION_PLAY:
                currentIsPlaying = true;
                updatePlaybackState();
                updateMediaNotification();
                evaluatePlayerCommand("__ftaIptvPlay");
                return true;
            case ACTION_PAUSE:
                currentIsPlaying = false;
                updatePlaybackState();
                updateMediaNotification();
                evaluatePlayerCommand("__ftaIptvPause");
                return true;
            case ACTION_TOGGLE_PLAYBACK:
                currentIsPlaying = !currentIsPlaying;
                updatePlaybackState();
                updateMediaNotification();
                evaluatePlayerCommand("__ftaIptvTogglePlayback");
                return true;
            default:
                return false;
        }
    }

    private void evaluatePlayerCommand(String functionName) {
        if (webView == null) return;
        webView.post(() -> webView.evaluateJavascript(
                "if(window." + functionName + "){window." + functionName + "();}",
                null
        ));
    }

    private void evaluatePlayerTouch(float relativeX, float relativeY) {
        if (webView == null) return;
        String script = "if(window.__ftaIptvShowControlsAt){window.__ftaIptvShowControlsAt("
                + Float.toString(relativeX) + "," + Float.toString(relativeY) + ");}";
        webView.post(() -> webView.evaluateJavascript(script, null));
    }

    private String nonEmpty(String value, String fallback) {
        if (value == null) return fallback;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? fallback : trimmed;
    }

    private boolean openIntentUrlInApp(String url) {
        try {
            Intent intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME);
            String fallbackUrl = intent.getStringExtra("browser_fallback_url");
            if (fallbackUrl != null) {
                pausePlayerThen(() -> openOfficialFallback(
                        fallbackUrl,
                        isSportyPlayback(null, fallbackUrl)
                ));
            }
        } catch (URISyntaxException ignored) {
            return true;
        }
        return true;
    }

    private void pausePlayerThen(Runnable nextAction) {
        suppressMediaSessionUpdates = true;
        currentIsPlaying = false;
        clearNativeMediaSession();
        if (webView == null) {
            nextAction.run();
            return;
        }

        AtomicBoolean completed = new AtomicBoolean(false);
        Runnable continueOnce = () -> {
            clearNativeMediaSession();
            if (completed.compareAndSet(false, true)) {
                if (webView != null) webView.onPause();
                nextAction.run();
            }
        };
        webView.evaluateJavascript(PAUSE_WEB_MEDIA_SCRIPT, ignored -> continueOnce.run());
        webView.postDelayed(continueOnce, 350);
    }

    private void openInstalledApp(String packageName, String fallbackUrl, String deepLinkUrl) {
        if (packageName == null || !packageName.matches("[A-Za-z0-9_.]+")) {
            openOfficialFallback(fallbackUrl, isSportyPlayback(packageName, fallbackUrl));
            return;
        }

        if (deepLinkUrl != null && !deepLinkUrl.trim().isEmpty()) {
            Intent deepLinkIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(deepLinkUrl));
            deepLinkIntent.addCategory(Intent.CATEGORY_BROWSABLE);
            deepLinkIntent.setPackage(packageName);
            if (deepLinkIntent.resolveActivity(getPackageManager()) != null) {
                startActivity(deepLinkIntent);
                return;
            }
        }

        Intent launchIntent = getPackageManager().getLaunchIntentForPackage(packageName);
        if (launchIntent != null) {
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
            startActivity(launchIntent);
            return;
        }

        try {
            Intent packageLauncher = new Intent(Intent.ACTION_MAIN);
            packageLauncher.addCategory(Intent.CATEGORY_LAUNCHER);
            packageLauncher.setPackage(packageName);
            packageLauncher.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
            startActivity(packageLauncher);
            return;
        } catch (ActivityNotFoundException ignored) {
            // Continue to the official website when an installed launcher cannot be resolved.
        }

        openOfficialFallback(fallbackUrl, isSportyPlayback(packageName, fallbackUrl));
    }

    private void openOfficialFallback(String url, boolean fullscreenPlayback) {
        if (url == null || url.trim().isEmpty()) return;
        Uri uri = Uri.parse(url.trim());
        String scheme = uri.getScheme();
        if (!"https".equalsIgnoreCase(scheme) && !"http".equalsIgnoreCase(scheme)) return;
        InAppBrowserActivity.open(this, uri.toString(), fullscreenPlayback);
    }

    private boolean isSportyPlayback(String packageName, String url) {
        if ("com.sporty.android".equals(packageName)) return true;
        if (url == null) return false;
        String host = Uri.parse(url).getHost();
        return host != null
                && ("sporty.com".equalsIgnoreCase(host)
                || host.toLowerCase(Locale.US).endsWith(".sporty.com"));
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (intent != null && handleMediaAction(intent.getAction())) return;
    }

    @Override
    public void onRequestPermissionsResult(
            int requestCode,
            String[] permissions,
            int[] grantResults
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == NOTIFICATION_PERMISSION_REQUEST
                && grantResults.length > 0
                && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            updateMediaNotification();
        }
    }

    @Override
    protected void onPause() {
        suppressMediaSessionUpdates = true;
        if (webView != null) {
            WebView pausingWebView = webView;
            AtomicBoolean completed = new AtomicBoolean(false);
            Runnable finishPause = () -> {
                clearNativeMediaSession();
                if (completed.compareAndSet(false, true) && webView == pausingWebView) {
                    pausingWebView.onPause();
                }
            };
            pausingWebView.evaluateJavascript(PAUSE_WEB_MEDIA_SCRIPT, ignored -> finishPause.run());
            pausingWebView.postDelayed(finishPause, 350);
        }
        clearNativeMediaSession();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        suppressMediaSessionUpdates = false;
        if (webView != null) webView.onResume();
    }

    @Override
    public void onBackPressed() {
        if (isTelevisionDevice && tvPanelOpen) {
            tvPanelOpen = false;
            tvPanelState = "none";
            evaluatePlayerCommand("__ftaIptvTvClosePanel");
            return;
        }
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        clearNativeMediaSession();
        if (mediaSession != null) {
            mediaSession.release();
            mediaSession = null;
        }
        super.onDestroy();
    }

    private final class AndroidMediaBridge {
        @JavascriptInterface
        public void update(
                String title,
                String artist,
                String artworkUrl,
                boolean canNavigate,
                boolean isPlaying
        ) {
            runOnUiThread(() -> {
                if (suppressMediaSessionUpdates) {
                    clearNativeMediaSession();
                    return;
                }
                updateNativeMediaSession(
                        title,
                        artist,
                        artworkUrl,
                        canNavigate,
                        isPlaying
                );
            });
        }

        @JavascriptInterface
        public void clear() {
            runOnUiThread(MainActivity.this::clearNativeMediaSession);
        }
    }

    private final class AndroidDeviceBridge {
        @JavascriptInterface
        public boolean isTelevision() {
            return isTelevisionDevice;
        }

        @JavascriptInterface
        public void setPanelOpen(boolean isOpen) {
            tvPanelOpen = isOpen;
            tvPanelState = isOpen ? "channels" : "none";
        }

        @JavascriptInterface
        public void setPanel(String panel) {
            String nextPanel = panel == null ? "none" : panel.trim().toLowerCase();
            if (!("channels".equals(nextPanel)
                    || "categories".equals(nextPanel)
                    || "settings".equals(nextPanel)
                    || "playback".equals(nextPanel)
                    || "services".equals(nextPanel))) {
                nextPanel = "none";
            }
            tvPanelState = nextPanel;
            tvPanelOpen = !"none".equals(nextPanel);
        }

        @JavascriptInterface
        public void openOfficialUrl(String url) {
            runOnUiThread(() -> pausePlayerThen(
                    () -> openOfficialFallback(url, isSportyPlayback(null, url))
            ));
        }

        @JavascriptInterface
        public void openOfficialApp(String packageName, String fallbackUrl, String deepLinkUrl) {
            runOnUiThread(() -> pausePlayerThen(
                    () -> openInstalledApp(packageName, fallbackUrl, deepLinkUrl)
            ));
        }

        @JavascriptInterface
        public void toggleOrientation() {
            if (isTelevisionDevice) return;
            runOnUiThread(() -> {
                int currentOrientation = getResources().getConfiguration().orientation;
                setRequestedOrientation(
                        currentOrientation == Configuration.ORIENTATION_LANDSCAPE
                                ? ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
                                : ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
                );
            });
        }
    }
}
