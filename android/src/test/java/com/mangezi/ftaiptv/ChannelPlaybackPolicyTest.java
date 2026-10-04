package com.mangezi.ftaiptv;

import org.junit.Test;
import static org.junit.Assert.*;

public class ChannelPlaybackPolicyTest {
    @Test public void permitsHttpAndHttpsStreamsWithQueries() {
        assertTrue(ChannelPlaybackPolicy.isNetworkUrl("https://example.com/master.m3u8?session=123"));
        assertTrue(ChannelPlaybackPolicy.isNetworkUrl("http://example.com:8080/live"));
    }
    @Test public void rejectsNonNetworkSourcesAndCredentials() {
        for (String value : new String[]{"file:///sdcard/video.mp4", "content://media/video/1",
                "javascript:alert(1)", "intent://player", "https:///missing-host",
                "https://user:password@example.com/live", "not a URL"}) {
            assertFalse(value, ChannelPlaybackPolicy.isNetworkUrl(value));
        }
        assertFalse(ChannelPlaybackPolicy.isNetworkUrl(null));
    }
}
