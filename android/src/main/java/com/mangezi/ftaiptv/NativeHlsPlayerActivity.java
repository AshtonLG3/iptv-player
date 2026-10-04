package com.mangezi.ftaiptv;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.Toast;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.annotation.Nullable;
import androidx.annotation.OptIn;
import androidx.core.view.WindowCompat;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.common.VideoSize;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.exoplayer.DefaultLoadControl;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector;
import androidx.media3.ui.AspectRatioFrameLayout;
import androidx.media3.ui.PlayerView;
import java.util.Collections;
import java.util.ArrayList;
import org.json.JSONArray;

/** Native Android playback for channels and the trusted ZBC website handoff. */
@OptIn(markerClass = UnstableApi.class)
public final class NativeHlsPlayerActivity extends Activity {
    private static final String EXTRA_STREAM_URL = "stream_url";
    private static final int MAX_VIDEO_WIDTH = 960;
    private static final int MAX_VIDEO_HEIGHT = 480;
    private static final int MIN_BUFFER_MS = 30_000;
    private static final int MAX_BUFFER_MS = 90_000;

    private final Handler retryHandler = new Handler(Looper.getMainLooper());
    private PlayerView playerView;
    private ExoPlayer player;
    private String streamUrl;
    private final ArrayList<String> sources = new ArrayList<>();
    private int sourceIndex;
    private int retryCount;
    private boolean officialZbc;
    private boolean dataSaver;
    private TextView statusView;
    private Button retryButton;
    private long resumePosition;
    private boolean resumePlaying = true;
    private String channelTitle;
    private static final String TAG = "RugareNativePlayer";
    private final Runnable progressLogger = new Runnable() {
        @Override public void run() {
            if (player == null) return;
            Log.i(TAG, "progress positionMs=" + player.getCurrentPosition()
                    + " playing=" + player.isPlaying() + " state=" + player.getPlaybackState());
            retryHandler.postDelayed(this, 5000);
        }
    };

    public static void openChannel(Context context, String sourcesJson, String title, String quality) {
        try {
            JSONArray requested = new JSONArray(sourcesJson);
            JSONArray allowed = new JSONArray();
            for (int i = 0; i < requested.length() && i < 50; i++) {
                String url = requested.optString(i).trim();
                if (ChannelPlaybackPolicy.isNetworkUrl(url)) allowed.put(url);
            }
            if (allowed.length() == 0) return;
            Intent intent = new Intent(context, NativeHlsPlayerActivity.class);
            intent.putExtra("channel_sources", allowed.toString());
            intent.putExtra("channel_title", title);
            intent.putExtra("data_saver", "data-saver".equals(quality));
            context.startActivity(intent);
        } catch (Exception ignored) {
            Toast.makeText(context, "No valid channel source is available", Toast.LENGTH_SHORT).show();
        }
    }

    public static void open(Context context, String streamUrl) {
        if (!TvStreamPolicy.isTrustedZbcPlaybackUrl(streamUrl)) return;
        Intent intent = new Intent(context, NativeHlsPlayerActivity.class);
        intent.putExtra(EXTRA_STREAM_URL, streamUrl);
        context.startActivity(intent);
    }

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        streamUrl = getIntent().getStringExtra(EXTRA_STREAM_URL);
        officialZbc = streamUrl != null;
        channelTitle = getIntent().getStringExtra("channel_title");
        if (channelTitle == null || channelTitle.trim().isEmpty()) channelTitle = "ZBC";
        dataSaver = getIntent().getBooleanExtra("data_saver", false);
        if (officialZbc && TvStreamPolicy.isTrustedZbcPlaybackUrl(streamUrl)) sources.add(streamUrl);
        if (!officialZbc) {
            try {
                JSONArray requested = new JSONArray(getIntent().getStringExtra("channel_sources"));
                for (int i = 0; i < requested.length() && i < 50; i++) {
                    String url = requested.optString(i);
                    if (ChannelPlaybackPolicy.isNetworkUrl(url)) sources.add(url);
                }
            } catch (Exception ignored) { }
        }
        if (sources.isEmpty()) {
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
        LinearLayout header = new LinearLayout(this);
        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.setBackgroundColor(0x99000000);
        Button back = new Button(this);
        back.setText("Channels");
        back.setOnClickListener(view -> finish());
        header.addView(back);
        statusView = new TextView(this);
        statusView.setTextColor(Color.WHITE);
        statusView.setTextSize(16);
        statusView.setText(channelTitle);
        header.addView(statusView, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        retryButton = new Button(this);
        retryButton.setText("Retry");
        retryButton.setVisibility(View.GONE);
        retryButton.setOnClickListener(view -> {
            sourceIndex = 0;
            retryCount = 0;
            resumePosition = 0;
            resumePlaying = true;
            prepareSource();
        });
        header.addView(retryButton);
        root.addView(header, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.TOP));
        playerView.setControllerVisibilityListener((PlayerView.ControllerVisibilityListener)
                visibility -> header.setVisibility(retryButton.getVisibility() == View.VISIBLE ? View.VISIBLE : visibility));
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
        DefaultTrackSelector.Parameters.Builder parameters = trackSelector.buildUponParameters()
                .setAllowVideoMixedMimeTypeAdaptiveness(true);
        if (officialZbc || dataSaver) parameters.setMaxVideoSize(MAX_VIDEO_WIDTH, MAX_VIDEO_HEIGHT);
        if (dataSaver) parameters.setForceLowestBitrate(true);
        trackSelector.setParameters(parameters);
        DefaultLoadControl loadControl = new DefaultLoadControl.Builder()
                .setBufferDurationsMs(MIN_BUFFER_MS, MAX_BUFFER_MS, 5_000, 10_000)
                .setPrioritizeTimeOverSizeThresholds(true)
                .build();
        DefaultHttpDataSource.Factory dataSourceFactory = new DefaultHttpDataSource.Factory()
                .setUserAgent("Rugare TV/" + BuildConfig.VERSION_NAME + " Android")
                .setConnectTimeoutMs(15_000)
                .setReadTimeoutMs(15_000)
                .setAllowCrossProtocolRedirects(true);
        if (officialZbc) dataSourceFactory.setDefaultRequestProperties(
                Collections.singletonMap("Referer", "https://zbc.ottplatform.com/"));

        player = new ExoPlayer.Builder(this)
                .setMediaSourceFactory(new DefaultMediaSourceFactory(this).setDataSourceFactory(dataSourceFactory))
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
                    retryHandler.removeCallbacks(startupTimeout);
                    statusView.setText(channelTitle);
                } else if (playbackState == Player.STATE_BUFFERING && player != null && player.getPlayWhenReady()) {
                    retryHandler.removeCallbacks(startupTimeout);
                    retryHandler.postDelayed(startupTimeout, 30000);
                }
            }

            @Override public void onRenderedFirstFrame() {
                Log.i(TAG, "first frame source=" + sourceIndex);
            }

            @Override public void onVideoSizeChanged(VideoSize size) {
                Log.i(TAG, "video size=" + size.width + "x" + size.height);
            }

            @Override
            public void onPlayerError(PlaybackException error) {
                Log.w(TAG, "playback error=" + error.getErrorCodeName() + " source=" + sourceIndex);
                recoverSource(error.getErrorCodeName());
            }
        });
        playerView.setPlayer(player);
        prepareSource();
        retryHandler.post(progressLogger);
    }

    private final Runnable startupTimeout = () -> recoverSource("Startup timed out");
    private final Runnable retrySource = () -> prepareSource();

    private void prepareSource() {
        if (player == null) return;
        retryHandler.removeCallbacks(startupTimeout);
        retryHandler.removeCallbacks(retrySource);
        retryButton.setVisibility(View.GONE);
        statusView.setText("Connecting…");
        MediaItem.Builder item = new MediaItem.Builder().setUri(sources.get(sourceIndex));
        if (officialZbc || sources.get(sourceIndex).toLowerCase().contains(".m3u8")) {
            item.setMimeType("application/x-mpegURL");
        }
        player.setMediaItem(item.build(), resumePosition);
        player.prepare();
        player.setPlayWhenReady(resumePlaying);
        retryHandler.postDelayed(startupTimeout, 30000);
    }

    private void recoverSource(String reason) {
        if (player == null || isFinishing()) return;
        retryHandler.removeCallbacks(startupTimeout);
        retryHandler.removeCallbacks(retrySource);
        if (sourceIndex + 1 < sources.size()) {
            sourceIndex++;
            retryCount = 0;
        } else if (retryCount++ >= 1) {
            player.stop();
            statusView.setText(reason.contains("DECOD") || reason.contains("FORMAT")
                    ? "This device cannot play this stream's format. Try another channel."
                    : "Channel unavailable. Retry or choose another channel.");
            retryButton.setVisibility(View.VISIBLE);
            playerView.showController();
            Log.w(TAG, "sources exhausted: " + reason);
            return;
        }
        resumePosition = 0;
        statusView.setText("Retrying…");
        retryHandler.postDelayed(retrySource, 1500);
    }

    @Override
    protected void onStop() {
        retryHandler.removeCallbacksAndMessages(null);
        if (playerView != null) playerView.setPlayer(null);
        if (player != null) {
            resumePosition = player.isCurrentMediaItemLive() ? 0 : player.getCurrentPosition();
            resumePlaying = player.getPlayWhenReady();
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

}
