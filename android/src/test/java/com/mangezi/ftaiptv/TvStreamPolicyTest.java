package com.mangezi.ftaiptv;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public final class TvStreamPolicyTest {
    private static final String ZBC_MASTER = "#EXTM3U\n"
            + "#EXT-X-STREAM-INF:BANDWIDTH=1160000,RESOLUTION=640x360,FRAME-RATE=60.000\n"
            + "tracks-v3a1/rewind-86400.ts.m3u8\n"
            + "#EXT-X-STREAM-INF:BANDWIDTH=2210000,RESOLUTION=852x480,FRAME-RATE=60.000\n"
            + "tracks-v2a1/rewind-86400.ts.m3u8\n"
            + "#EXT-X-STREAM-INF:BANDWIDTH=4820000,RESOLUTION=1920x1080,FRAME-RATE=60.000\n"
            + "tracks-v1a1/rewind-86400.ts.m3u8\n";

    @Test
    public void capsZbcTvPlaybackWithoutRemovingStableVariants() {
        String capped = TvStreamPolicy.capHlsMasterPlaylist(ZBC_MASTER, 720);

        assertTrue(capped.contains("640x360"));
        assertTrue(capped.contains("852x480"));
        assertFalse(capped.contains("1920x1080"));
        assertFalse(capped.contains("tracks-v1a1"));
    }

    @Test
    public void leavesSingleHighQualityManifestIntactInsteadOfBreakingPlayback() {
        String highOnly = "#EXTM3U\n"
                + "#EXT-X-STREAM-INF:BANDWIDTH=4820000,RESOLUTION=1920x1080\n"
                + "high.m3u8\n";

        assertEquals(highOnly, TvStreamPolicy.capHlsMasterPlaylist(highOnly, 720));
    }
}
