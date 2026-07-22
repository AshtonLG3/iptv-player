package com.mangezi.ftaiptv;

import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.net.Uri;
import android.os.Bundle;
import android.os.Build;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.webkit.WebViewAssetLoader;
import java.net.URISyntaxException;

public final class MainActivity extends Activity {
    private static final String APP_ASSET_HOST = "appassets.androidplatform.net";
    private static final String MEDIA_NOTIFICATION_CHANNEL_ID = "playback";
    private static final int MEDIA_NOTIFICATION_ID = 1001;
    private static final String ACTION_PREVIOUS = "com.mangezi.ftaiptv.action.PREVIOUS";
    private static final String ACTION_NEXT = "com.mangezi.ftaiptv.action.NEXT";
    private static final String ACTION_PLAY = "com.mangezi.ftaiptv.action.PLAY";
    private static final String ACTION_PAUSE = "com.mangezi.ftaiptv.action.PAUSE";
    private static final String ACTION_TOGGLE_PLAYBACK = "com.mangezi.ftaiptv.action.TOGGLE_PLAYBACK";
    private WebView webView;
    private MediaSession mediaSession;
    private NotificationManager notificationManager;
    private String currentTitle = "";
    private String currentArtist = "";
    private String currentArtworkUrl = "";
    private boolean currentCanNavigate;
    private boolean currentIsPlaying;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setTitle(getString(R.string.app_name));
        createMediaSession();

        WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        webView = new WebView(this);
        webView.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));

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
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                String scheme = url.getScheme();
                if ("intent".equals(scheme)) {
                    return openIntentUrl(url.toString());
                }

                if (!("http".equals(scheme) || "https".equals(scheme))) {
                    return true;
                }

                if (APP_ASSET_HOST.equals(url.getHost())) {
                    return false;
                }

                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, url));
                    return true;
                } catch (ActivityNotFoundException ignored) {
                    return false;
                }
            }
        });

        setContentView(webView);
        webView.loadUrl("https://appassets.androidplatform.net/assets/index.html");
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
        updateMediaNotification();
    }

    private void clearNativeMediaSession() {
        currentTitle = "";
        currentArtist = "";
        currentArtworkUrl = "";
        currentCanNavigate = false;
        currentIsPlaying = false;
        if (mediaSession != null) {
            updatePlaybackState();
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

    private String nonEmpty(String value, String fallback) {
        if (value == null) return fallback;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? fallback : trimmed;
    }

    private boolean openIntentUrl(String url) {
        try {
            Intent intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME);
            try {
                startActivity(intent);
            } catch (ActivityNotFoundException missingApp) {
                String fallbackUrl = intent.getStringExtra("browser_fallback_url");
                if (fallbackUrl == null) return true;
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(fallbackUrl)));
            }
        } catch (ActivityNotFoundException | URISyntaxException ignored) {
            return true;
        }
        return true;
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (intent != null && handleMediaAction(intent.getAction())) return;
    }

    @Override
    public void onBackPressed() {
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
            runOnUiThread(() -> updateNativeMediaSession(
                    title,
                    artist,
                    artworkUrl,
                    canNavigate,
                    isPlaying
            ));
        }

        @JavascriptInterface
        public void clear() {
            runOnUiThread(MainActivity.this::clearNativeMediaSession);
        }
    }
}
