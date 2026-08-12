package com.mangezi.ftaiptv;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.Toast;
import androidx.annotation.Nullable;
import androidx.annotation.OptIn;
import androidx.core.view.WindowCompat;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.exoplayer.DefaultLoadControl;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.hls.HlsMediaSource;
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector;
import androidx.media3.ui.AspectRatioFrameLayout;
import androidx.media3.ui.PlayerView;
import java.util.Collections;
import java.util.Locale;

/** TV-only native playback for official ZBC HLS streams selected on the Z+ website. */
@OptIn(markerClass = UnstableApi.class)
public final class NativeHlsPlayerActivity extends Activity {
    private static final String EXTRA_STREAM_URL = "stream_url";
    private static final int MAX_VIDEO_WIDTH = 854;
    private static final int MAX_VIDEO_HEIGHT = 480;
    private static final int MIN_BUFFER_MS = 30_000;
    private static final int MAX_BUFFER_MS = 90_000;

    private final Handler retryHandler = new Handler(Looper.getMainLooper());
    private PlayerView playerView;
    private ExoPlayer player;
    private String streamUrl;

    public static void open(Context context, String streamUrl) {
        if (!isTrustedZbcStream(streamUrl)) return;
        Intent intent = new Intent(context, NativeHlsPlayerActivity.class);
        intent.putExtra(EXTRA_STREAM_URL, streamUrl);
        context.startActivity(intent);
    }

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        streamUrl = getIntent().getStringExtra(EXTRA_STREAM_URL);
        if (!isTrustedZbcStream(streamUrl)) {
            finish();
            return;
        }

        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE);
        enterImmersiveMode();

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);
        playerView = new PlayerView(this);
        playerView.setBackgroundColor(Color.BLACK);
        playerView.setResizeMode(AspectRatioFrameLayout.RESIZE_MODE_FIT);
        playerView.setUseController(true);
        playerView.setControllerAutoShow(true);
        playerView.setControllerShowTimeoutMs(5_000);
        playerView.setFocusable(true);
        playerView.setFocusableInTouchMode(true);
        root.addView(playerView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));
        setContentView(root);
        playerView.requestFocus();
    }

    @Override
    protected void onStart() {
        super.onStart();
        initializePlayer();
    }

    private void initializePlayer() {
        if (player != null) return;

        DefaultTrackSelector trackSelector = new DefaultTrackSelector(this);
        trackSelector.setParameters(trackSelector.buildUponParameters()
                .setMaxVideoSize(MAX_VIDEO_WIDTH, MAX_VIDEO_HEIGHT)
                .setAllowVideoMixedMimeTypeAdaptiveness(true));
        DefaultLoadControl loadControl = new DefaultLoadControl.Builder()
                .setBufferDurationsMs(MIN_BUFFER_MS, MAX_BUFFER_MS, 5_000, 10_000)
                .setPrioritizeTimeOverSizeThresholds(true)
                .build();
        DefaultHttpDataSource.Factory dataSourceFactory = new DefaultHttpDataSource.Factory()
                .setUserAgent("Rugare TV/Android TV")
                .setConnectTimeoutMs(15_000)
                .setReadTimeoutMs(15_000)
                .setAllowCrossProtocolRedirects(true)
                .setDefaultRequestProperties(Collections.singletonMap(
                        "Referer",
                        "https://zbc.ottplatform.com/"
                ));

        player = new ExoPlayer.Builder(this)
                .setTrackSelector(trackSelector)
                .setLoadControl(loadControl)
                .build();
        player.setAudioAttributes(
                new AudioAttributes.Builder()
                        .setUsage(C.USAGE_MEDIA)
                        .setContentType(C.AUDIO_CONTENT_TYPE_MOVIE)
                        .build(),
                true
        );
        player.setVolume(1f);
        player.addListener(new Player.Listener() {
            @Override
            public void onPlaybackStateChanged(int playbackState) {
                if (playbackState == Player.STATE_READY && player != null) {
                    player.setVolume(1f);
                }
            }

            @Override
            public void onPlayerError(PlaybackException error) {
                Toast.makeText(
                        NativeHlsPlayerActivity.this,
                        R.string.stream_interrupted_retrying,
                        Toast.LENGTH_SHORT
                ).show();
                retryHandler.removeCallbacksAndMessages(null);
                retryHandler.postDelayed(() -> {
                    if (player == null) return;
                    player.prepare();
                    player.play();
                }, 3_000);
            }
        });
        playerView.setPlayer(player);
        HlsMediaSource mediaSource = new HlsMediaSource.Factory(dataSourceFactory)
                .setAllowChunklessPreparation(true)
                .createMediaSource(MediaItem.fromUri(streamUrl));
        player.setMediaSource(mediaSource);
        player.prepare();
        player.play();
    }

    @Override
    protected void onStop() {
        retryHandler.removeCallbacksAndMessages(null);
        if (playerView != null) playerView.setPlayer(null);
        if (player != null) {
            player.release();
            player = null;
        }
        super.onStop();
    }

    @Override
    protected void onResume() {
        super.onResume();
        enterImmersiveMode();
    }

    @SuppressWarnings("deprecation")
    private void enterImmersiveMode() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        );
    }

    private static boolean isTrustedZbcStream(String value) {
        if (value == null) return false;
        Uri uri = Uri.parse(value);
        String host = uri.getHost();
        String path = uri.getPath();
        return "https".equalsIgnoreCase(uri.getScheme())
                && host != null
                && ("castr.net".equalsIgnoreCase(host)
                || host.toLowerCase(Locale.US).endsWith(".castr.net"))
                && path != null
                && path.toLowerCase(Locale.US).endsWith(".m3u8");
    }
}
