package com.mangezi.ftaiptv;

import android.content.Context;
import android.content.SharedPreferences;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.JSONObject;

final class InstallReporter {
    private static final String ENDPOINT =
            "https://mangezi.xyz/rugare-install-counter.php";
    private static final String PREFERENCES = "rugare_install_metrics";
    private static final String INSTALL_ID = "install_id";
    private static final String REPORTED = "reported";
    private static final int TIMEOUT_MS = 10_000;
    private static final int MAX_RESPONSE_BYTES = 4_096;
    private static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor();
    private static final AtomicBoolean REPORT_IN_FLIGHT = new AtomicBoolean(false);

    private InstallReporter() {
    }

    static void report(Context context) {
        Context appContext = context.getApplicationContext();
        SharedPreferences preferences =
                appContext.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
        if (preferences.getBoolean(REPORTED, false)
                || !REPORT_IN_FLIGHT.compareAndSet(false, true)) {
            return;
        }

        String existingId = preferences.getString(INSTALL_ID, null);
        String installId = existingId == null || existingId.trim().isEmpty()
                ? UUID.randomUUID().toString()
                : existingId;
        if (!installId.equals(existingId)) {
            preferences.edit().putString(INSTALL_ID, installId).commit();
        }

        EXECUTOR.execute(() -> {
            try {
                if (submit(installId)) {
                    preferences.edit().putBoolean(REPORTED, true).apply();
                }
            } catch (Exception ignored) {
                // A later launch retries; reporting must never interrupt playback.
            } finally {
                REPORT_IN_FLIGHT.set(false);
            }
        });
    }

    private static boolean submit(String installId) throws Exception {
        JSONObject payload = new JSONObject();
        payload.put("package_name", BuildConfig.APPLICATION_ID);
        payload.put("install_id", installId);
        payload.put("version_name", BuildConfig.VERSION_NAME);
        payload.put("version_code", BuildConfig.VERSION_CODE);
        byte[] body = payload.toString().getBytes(StandardCharsets.UTF_8);

        HttpURLConnection connection = (HttpURLConnection) new URL(ENDPOINT).openConnection();
        try {
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(TIMEOUT_MS);
            connection.setReadTimeout(TIMEOUT_MS);
            connection.setDoOutput(true);
            connection.setFixedLengthStreamingMode(body.length);
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty(
                    "User-Agent",
                    "RugareTV/" + BuildConfig.VERSION_NAME + " Android"
            );
            try (OutputStream output = connection.getOutputStream()) {
                output.write(body);
            }

            if (connection.getResponseCode() != HttpURLConnection.HTTP_OK) {
                return false;
            }
            try (InputStream input = connection.getInputStream()) {
                JSONObject response = new JSONObject(readLimited(input));
                return response.optBoolean("ok", false);
            }
        } finally {
            connection.disconnect();
        }
    }

    private static String readLimited(InputStream input) throws Exception {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[1_024];
        int total = 0;
        int read;
        while ((read = input.read(buffer)) != -1) {
            total += read;
            if (total > MAX_RESPONSE_BYTES) {
                throw new IllegalStateException("Install counter response is too large");
            }
            output.write(buffer, 0, read);
        }
        return output.toString(StandardCharsets.UTF_8.name());
    }
}
