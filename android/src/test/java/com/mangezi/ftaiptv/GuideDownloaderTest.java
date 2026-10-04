package com.mangezi.ftaiptv;

import static org.junit.Assert.*;
import java.net.ServerSocket;
import java.net.Socket;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.zip.GZIPOutputStream;
import org.junit.Test;

public class GuideDownloaderTest {
    private static final class Fixture implements AutoCloseable {
        final ServerSocket socket = new ServerSocket(0);
        Fixture(byte[] body, boolean redirect, int status) throws Exception {
            Thread worker = new Thread(() -> {
                try {
                    for (int i = 0; i < (redirect ? 2 : 1); i++) {
                        try (Socket client = socket.accept()) {
                            client.setSoTimeout(5000);
                            BufferedReader reader = new BufferedReader(new InputStreamReader(client.getInputStream(), StandardCharsets.US_ASCII));
                            String line;
                            while ((line = reader.readLine()) != null && !line.isEmpty()) { }
                            boolean isRedirect = redirect && i == 0;
                            String headers = isRedirect ? "HTTP/1.1 302 Found\r\nLocation: /guide.xml.gz\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
                                : "HTTP/1.1 " + status + " Response\r\nContent-Length: " + body.length + "\r\nConnection: close\r\n\r\n";
                            client.getOutputStream().write(headers.getBytes(StandardCharsets.US_ASCII));
                            if (!isRedirect) client.getOutputStream().write(body);
                            client.getOutputStream().flush();
                        }
                    }
                } catch (Exception ignored) { /* Downloader assertions report fixture failure. */ }
            });
            worker.setDaemon(true); worker.start();
        }
        String url() { return "http://127.0.0.1:" + socket.getLocalPort() + "/redirect"; }
        public void close() throws Exception { socket.close(); }
    }

    @Test public void followsRedirectAndReadsGzipGuide() throws Exception {
        String xml = "<tv><channel id=\"test\"><display-name>News</display-name></channel></tv>";
        ByteArrayOutputStream compressed = new ByteArrayOutputStream();
        try (GZIPOutputStream gzip = new GZIPOutputStream(compressed)) { gzip.write(xml.getBytes(StandardCharsets.UTF_8)); }
        try (Fixture fixture = new Fixture(compressed.toByteArray(), true, 200)) {
            assertEquals(xml, GuideDownloader.download(fixture.url()));
        }
    }
    @Test public void rejectsUnsupportedProtocol() throws Exception {
        try { GuideDownloader.download("file:///private.xml"); fail("File URL must be rejected"); }
        catch (Exception error) { assertTrue(error.getMessage().contains("HTTP or HTTPS")); }
    }
    @Test public void reportsHttpFailureWithoutAcceptingErrorPage() throws Exception {
        try (Fixture fixture = new Fixture(new byte[0], false, 404)) {
            try { GuideDownloader.download(fixture.url()); fail("HTTP failure must be rejected"); }
            catch (Exception error) { assertTrue(error.getMessage().contains("HTTP 404")); }
        }
    }
}
