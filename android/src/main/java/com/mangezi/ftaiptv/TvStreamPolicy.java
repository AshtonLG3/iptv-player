package com.mangezi.ftaiptv;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

final class TvStreamPolicy {
    private static final Pattern RESOLUTION_HEIGHT =
            Pattern.compile("(?:^|,)RESOLUTION=\\d+x(\\d+)(?:,|$)", Pattern.CASE_INSENSITIVE);
    private static final Pattern ZBC_VOD_MASTER = Pattern.compile(
            "^/videos/[A-Za-z0-9_-]+/[A-Za-z0-9_-]+\\.mp4/index\\.m3u8$",
            Pattern.CASE_INSENSITIVE
    );

    private TvStreamPolicy() {}

    static boolean hasVideoVariants(String manifest) {
        return manifest != null && RESOLUTION_HEIGHT.matcher(manifest).find();
    }

    static boolean isTrustedZbcPlaybackUrl(String value) {
        if (value == null || value.trim().isEmpty()) return false;
        try {
            URI uri = new URI(value);
            String host = uri.getHost();
            String path = uri.getPath();
            if (!"https".equalsIgnoreCase(uri.getScheme()) || host == null || path == null) {
                return false;
            }
            host = host.toLowerCase(Locale.US);
            path = path.toLowerCase(Locale.US);

            boolean officialLiveMaster = host.endsWith(".castr.net")
                    && host.startsWith("stream-")
                    && path.endsWith("/rewind-86400.m3u8")
                    && !path.endsWith("/rewind-86400.ts.m3u8");
            boolean officialVodMaster = "stream-vod.castr.net".equals(host)
                    && ZBC_VOD_MASTER.matcher(path).matches();
            return officialLiveMaster || officialVodMaster;
        } catch (URISyntaxException ignored) {
            return false;
        }
    }

    static String capHlsMasterPlaylist(String manifest, int maxHeight) {
        if (manifest == null || manifest.isEmpty() || maxHeight <= 0) return manifest;
        String[] lines = manifest.split("\\r?\\n", -1);
        StringBuilder result = new StringBuilder(manifest.length());
        boolean dropVariantUri = false;
        boolean removedVariant = false;
        int retainedVariants = 0;

        for (String line : lines) {
            if (dropVariantUri) {
                if (line.trim().isEmpty() || line.startsWith("#")) continue;
                dropVariantUri = false;
                continue;
            }

            if (line.startsWith("#EXT-X-STREAM-INF:")) {
                Matcher matcher = RESOLUTION_HEIGHT.matcher(line);
                if (matcher.find() && Integer.parseInt(matcher.group(1)) > maxHeight) {
                    removedVariant = true;
                    dropVariantUri = true;
                    continue;
                }
                retainedVariants += 1;
            }
            result.append(line).append('\n');
        }

        if (!removedVariant || retainedVariants == 0) return manifest;
        return result.toString();
    }
}
