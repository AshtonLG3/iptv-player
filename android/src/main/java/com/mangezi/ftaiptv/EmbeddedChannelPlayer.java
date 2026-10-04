package com.mangezi.ftaiptv;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import androidx.annotation.OptIn;
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
import androidx.media3.ui.PlayerView;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;

/** Native decoding inside the existing web UI, which owns browsing and all controls. */
@OptIn(markerClass = UnstableApi.class)
final class EmbeddedChannelPlayer {
    interface Listener { void onState(JSONObject state); }
    private static final String TAG = "RugareInlinePlayer";
    private final Context context;
    private final PlayerView view;
    private final Listener listener;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ArrayList<String> sources = new ArrayList<>();
    private ExoPlayer player;
    private int request;
    private int index;
    private int retries;
    private boolean firstFrame;
    private boolean failed;
    private final Runnable timeout = () -> recover("Stream startup timed out");
    private final Runnable retry = () -> prepare();

    EmbeddedChannelPlayer(Context context, PlayerView view, Listener listener) {
        this.context = context;
        this.view = view;
        this.listener = listener;
    }

    void play(String json, String title, String quality, int requestId) {
        stop();
        request = requestId;
        sources.clear();
        try {
            JSONArray items = new JSONArray(json);
            for (int i = 0; i < items.length() && i < 50; i++) {
                String url = items.optString(i).trim();
                if (ChannelPlaybackPolicy.isNetworkUrl(url) && !sources.contains(url)) sources.add(url);
            }
        } catch (Exception ignored) { }
        if (sources.isEmpty()) { emit("No valid stream source is available"); return; }
        index = 0;
        retries = 0;
        failed = false;
        DefaultTrackSelector selector = new DefaultTrackSelector(context);
        if ("data-saver".equals(quality)) selector.setParameters(selector.buildUponParameters()
                .setMaxVideoSize(960, 480).setForceLowestBitrate(true));
        DefaultHttpDataSource.Factory http = new DefaultHttpDataSource.Factory()
                .setUserAgent("Rugare TV/" + BuildConfig.VERSION_NAME + " Android")
                .setConnectTimeoutMs(15000).setReadTimeoutMs(15000).setAllowCrossProtocolRedirects(true);
        player = new ExoPlayer.Builder(context)
                .setMediaSourceFactory(new DefaultMediaSourceFactory(context).setDataSourceFactory(http))
                .setTrackSelector(selector)
                .setLoadControl(new DefaultLoadControl.Builder()
                        .setBufferDurationsMs(15000, 50000, 1500, 3000).build())
                .build();
        player.setAudioAttributes(new AudioAttributes.Builder().setUsage(C.USAGE_MEDIA)
                .setContentType(C.AUDIO_CONTENT_TYPE_MOVIE).build(), true);
        final ExoPlayer active = player;
        player.addListener(new Player.Listener() {
            @Override public void onIsPlayingChanged(boolean playing) {
                if (player == active) emit(null);
            }
            @Override public void onPlaybackStateChanged(int state) {
                if (player != active) return;
                handler.removeCallbacks(timeout);
                if (state == Player.STATE_BUFFERING && player.getPlayWhenReady() && !failed)
                    handler.postDelayed(timeout, 30000);
                emit(null);
            }
            @Override public void onRenderedFirstFrame() {
                if (player != active) return;
                firstFrame = true;
                Log.i(TAG, "first frame request=" + request);
                emit(null);
            }
            @Override public void onVideoSizeChanged(VideoSize size) {
                if (player == active) Log.i(TAG, "video=" + size.width + "x" + size.height + " request=" + request);
            }
            @Override public void onPlayerError(PlaybackException error) {
                if (player != active) return;
                Log.w(TAG, "error=" + error.getErrorCodeName() + " request=" + request);
                recover(error.getErrorCodeName());
            }
        });
        view.setPlayer(player);
        Log.i(TAG, "play title=" + title + " request=" + request + " quality=" + quality);
        prepare();
    }

    private void prepare() {
        if (player == null) return;
        handler.removeCallbacks(retry);
        handler.removeCallbacks(timeout);
        firstFrame = false;
        MediaItem.Builder item = new MediaItem.Builder().setUri(sources.get(index));
        if (sources.get(index).toLowerCase(java.util.Locale.ROOT).contains(".m3u8"))
            item.setMimeType("application/x-mpegURL");
        player.setMediaItem(item.build());
        player.prepare();
        player.play();
        handler.postDelayed(timeout, 30000);
    }

    private void recover(String reason) {
        if (player == null || failed) return;
        handler.removeCallbacks(timeout);
        handler.removeCallbacks(retry);
        if (index + 1 < sources.size()) { index++; retries = 0; }
        else if (retries++ >= 1) {
            failed = true;
            player.stop();
            emit(reason);
            return;
        }
        handler.postDelayed(retry, 1500);
    }

    void pause() {
        handler.removeCallbacks(timeout);
        handler.removeCallbacks(retry);
        if (player != null) player.pause();
    }

    void resume() {
        if (player == null) return;
        if (failed || player.getPlaybackState() == Player.STATE_IDLE) {
            failed = false;
            retries = 0;
            prepare();
        } else {
            if (player.isCurrentMediaItemLive()) player.seekToDefaultPosition();
            player.play();
        }
    }

    void stop() {
        handler.removeCallbacksAndMessages(null);
        if (player != null) {
            ExoPlayer previous = player;
            player = null;
            view.setPlayer(null);
            previous.release();
        }
    }

    private void emit(String error) {
        try {
            JSONObject state = new JSONObject();
            state.put("session", request);
            state.put("playing", player != null && player.isPlaying());
            state.put("ready", firstFrame && !failed);
            state.put("ended", player != null && player.getPlaybackState() == Player.STATE_ENDED);
            if (error != null) state.put("error", error);
            Log.i(TAG, "state request=" + request + " playing=" + state.optBoolean("playing")
                    + " ready=" + state.optBoolean("ready"));
            listener.onState(state);
        } catch (Exception ignored) { }
    }
}
