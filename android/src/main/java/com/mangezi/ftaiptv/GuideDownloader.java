package com.mangezi.ftaiptv;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.PushbackInputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.zip.GZIPInputStream;

final class GuideDownloader {
    private static final int MAX_BYTES = 20 * 1024 * 1024;
    static String download(String address) throws Exception {
        URL url = new URL(address);
        for (int redirects = 0; redirects < 6; redirects++) {
            if (!"https".equals(url.getProtocol()) && !"http".equals(url.getProtocol()))
                throw new Exception("Use an HTTP or HTTPS XMLTV URL.");
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(15000);
            connection.setInstanceFollowRedirects(false);
            connection.setRequestProperty("Accept-Encoding", "gzip");
            connection.setRequestProperty("User-Agent", "Rugare TV/" + BuildConfig.VERSION_NAME);
            try {
                int status = connection.getResponseCode();
                if (status >= 300 && status < 400) {
                    String location = connection.getHeaderField("Location");
                    if (location == null) throw new Exception("Guide redirect has no destination.");
                    url = new URL(url, location);
                    continue;
                }
                if (status != 200) throw new Exception("Guide download failed (HTTP " + status + ").");
                if (connection.getContentLengthLong() > MAX_BYTES) throw new Exception("Guide exceeds 20 MB.");
                try (PushbackInputStream input = new PushbackInputStream(connection.getInputStream(), 2)) {
                    int first = input.read(); int second = input.read();
                    if (second >= 0) input.unread(second);
                    if (first >= 0) input.unread(first);
                    InputStream decoded = first == 0x1f && second == 0x8b ? new GZIPInputStream(input) : input;
                    try (InputStream stream = decoded; ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                        byte[] buffer = new byte[8192]; int count;
                        long deadline = System.nanoTime() + 30_000_000_000L;
                        while ((count = stream.read(buffer)) != -1) {
                            if (output.size() + count > MAX_BYTES) throw new Exception("Uncompressed guide exceeds 20 MB.");
                            if (System.nanoTime() > deadline) throw new Exception("Guide download timed out.");
                            output.write(buffer, 0, count);
                        }
                        return output.toString(StandardCharsets.UTF_8.name());
                    }
                }
            } finally { connection.disconnect(); }
        }
        throw new Exception("Too many guide redirects.");
    }
}
