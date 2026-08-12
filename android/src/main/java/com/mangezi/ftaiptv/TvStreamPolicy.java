package com.mangezi.ftaiptv;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

final class TvStreamPolicy {
    private static final Pattern RESOLUTION_HEIGHT =
            Pattern.compile("(?:^|,)RESOLUTION=\\d+x(\\d+)(?:,|$)", Pattern.CASE_INSENSITIVE);

    private TvStreamPolicy() {}

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
