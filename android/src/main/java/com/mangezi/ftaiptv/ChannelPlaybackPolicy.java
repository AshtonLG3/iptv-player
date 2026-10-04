package com.mangezi.ftaiptv;

import java.net.URI;

/** Native channel playback accepts network media, never local files or app intents. */
final class ChannelPlaybackPolicy {
    static boolean isNetworkUrl(String value) {
        if (value == null || value.length() > 16384) return false;
        try {
            URI uri = new URI(value.trim());
            return ("https".equalsIgnoreCase(uri.getScheme()) || "http".equalsIgnoreCase(uri.getScheme()))
                    && uri.getHost() != null && uri.getUserInfo() == null;
        } catch (Exception ignored) {
            return false;
        }
    }
}
