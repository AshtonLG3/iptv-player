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
        String capped = TvStreamPolicy.capHlsMasterPlaylist(ZBC_MASTER, 480);

        assertTrue(TvStreamPolicy.hasVideoVariants(ZBC_MASTER));
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

    @Test
    public void doesNotSendAudioOnlyChannelsToTheNativeVideoPlayer() {
        String audioOnly = "#EXTM3U\n"
                + "#EXT-X-STREAM-INF:BANDWIDTH=128000,CODECS=\"mp4a.40.2\"\n"
                + "audio.m3u8\n";

        assertFalse(TvStreamPolicy.hasVideoVariants(audioOnly));
    }

    @Test
    public void acceptsOfficialZbcLiveAndVodMasterPlaylists() {
        assertTrue(TvStreamPolicy.isTrustedZbcPlaybackUrl(
                "https://stream-185747.castr.net/account/live_channel/rewind-86400.m3u8"
        ));
        assertTrue(TvStreamPolicy.isTrustedZbcPlaybackUrl(
                "https://stream-vod.castr.net/videos/vd176342004cc311f0845a/"
                        + "Sop17nMhVmNPhDhR.mp4/index.m3u8"
        ));
    }

    @Test
    public void rejectsSegmentsVariantsAndUnrelatedCastrUrls() {
        assertFalse(TvStreamPolicy.isTrustedZbcPlaybackUrl(
                "https://stream-185747.castr.net/account/live_channel/rewind-86400.ts.m3u8"
        ));
        assertFalse(TvStreamPolicy.isTrustedZbcPlaybackUrl(
                "https://castr-vod.global.ssl.fastly.net/videos/account/video-480p.m3u8"
        ));
        assertFalse(TvStreamPolicy.isTrustedZbcPlaybackUrl(
                "https://example.com/videos/account/video.mp4/index.m3u8"
        ));
    }
}
