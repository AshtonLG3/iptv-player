package com.mangezi.ftaiptv;

import android.app.Activity;
import android.graphics.Color;
import android.view.LayoutInflater;
import android.view.View;
import android.view.WindowManager;
import android.widget.FrameLayout;
import androidx.media3.ui.PlayerView;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** Owns the native video surfaces behind the WebView's Multiview controls. */
final class MultiviewPlayers {
    private static final int MAX_TILES = 4;
    private final Activity activity;
    private final FrameLayout container;
    private final EmbeddedChannelPlayer.Listener listener;
    private final PlayerView[] views = new PlayerView[MAX_TILES];
    private final EmbeddedChannelPlayer[] players = new EmbeddedChannelPlayer[MAX_TILES];
    private final int[] sessions = new int[MAX_TILES];

    MultiviewPlayers(Activity activity, FrameLayout root, EmbeddedChannelPlayer.Listener listener) {
        this.activity = activity;
        this.listener = listener;
        container = new FrameLayout(activity);
        root.addView(container, new FrameLayout.LayoutParams(-1, -1));
    }

    void play(int tile, String sources, String title, int session, boolean audible) {
        if (tile < 0 || tile >= MAX_TILES) return;
        if (players[tile] == null) {
            PlayerView view = (PlayerView) LayoutInflater.from(activity)
                    .inflate(R.layout.inline_channel_player, container, false);
            view.setBackgroundColor(Color.BLACK);
            view.setVisibility(View.INVISIBLE);
            views[tile] = view;
            container.addView(view, new FrameLayout.LayoutParams(1, 1));
            players[tile] = new EmbeddedChannelPlayer(activity, view, state -> onState(tile, state));
        }
        sessions[tile] = session;
        activity.getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        players[tile].play(sources, title, "data-saver", session, true, audible);
    }

    private void onState(int tile, JSONObject state) {
        int session = state.optInt("session");
        if (sessions[tile] != session) return;
        try {
            state.put("tile", tile);
            listener.onState(state);
        } catch (JSONException ignored) { }
        if (state.has("error") || state.optBoolean("ended")) {
            container.post(() -> {
                if (players[tile] != null && sessions[tile] == session) players[tile].stop();
            });
        }
    }

    void setAudio(int audible) {
        for (int i = 0; i < MAX_TILES; i++) {
            if (players[i] != null) players[i].setAudible(i == audible);
        }
    }

    void setBounds(String json, int width) {
        try {
            JSONObject bounds = new JSONObject(json);
            double scale = width / bounds.getDouble("viewportWidth");
            if (Double.isNaN(scale) || Double.isInfinite(scale) || scale <= 0) return;
            JSONArray tiles = bounds.getJSONArray("tiles");
            for (int i = 0; i < MAX_TILES; i++) {
                if (views[i] == null) continue;
                JSONObject rect = tiles.optJSONObject(i);
                if (rect == null || rect.getDouble("width") <= 0 || rect.getDouble("height") <= 0) {
                    views[i].setVisibility(View.INVISIBLE);
                    continue;
                }
                FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
                        (int) Math.round(rect.getDouble("width") * scale),
                        (int) Math.round(rect.getDouble("height") * scale));
                params.leftMargin = (int) Math.round(rect.getDouble("left") * scale);
                params.topMargin = (int) Math.round(rect.getDouble("top") * scale);
                views[i].setLayoutParams(params);
                views[i].setVisibility(View.VISIBLE);
            }
        } catch (JSONException ignored) { }
    }

    void stop() {
        for (int i = 0; i < MAX_TILES; i++) stopTile(i);
    }

    boolean hasTiles() { return container.getChildCount() != 0; }

    void stopTile(int tile) {
        if (tile < 0 || tile >= MAX_TILES || players[tile] == null) return;
        players[tile].stop();
        players[tile] = null;
        container.removeView(views[tile]);
        views[tile] = null;
    }
}
