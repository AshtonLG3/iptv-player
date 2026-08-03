package com.mangezi.ftaiptv;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.widget.Toast;
import androidx.core.content.FileProvider;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.JSONException;
import org.json.JSONObject;

/** Downloads and verifies signed Rugare TV updates hosted on mangezi.xyz. */
final class UpdateManager {
    interface Listener {
        void onStatus(String message);
    }

    private static final String UPDATE_METADATA_URL = "https://mangezi.xyz/tv/update.json";
    private static final String UPDATE_HOST = "mangezi.xyz";
    private static final String UPDATE_FILE_NAME = "rugare-tv-update.apk";
    private static final String APK_MIME_TYPE = "application/vnd.android.package-archive";
    private static final int MAX_METADATA_BYTES = 64 * 1024;
    private static final long DOWNLOAD_POLL_INTERVAL_MS = 1000L;

    private final Activity activity;
    private final Listener listener;
    private final DownloadManager downloadManager;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final AtomicBoolean checking = new AtomicBoolean(false);
    private final AtomicBoolean downloading = new AtomicBoolean(false);

    private volatile boolean destroyed;
    private long activeDownloadId = -1L;
    private UpdateInfo activeDownloadInfo;
    private AlertDialog updateDialog;
    private File pendingInstallFile;
    private boolean waitingForInstallPermission;

    UpdateManager(Activity activity, Listener listener) {
        this.activity = activity;
        this.listener = listener;
        this.downloadManager = (DownloadManager) activity.getSystemService(Context.DOWNLOAD_SERVICE);
    }

    void checkForUpdates(boolean userInitiated) {
        if (destroyed) return;
        if (!checking.compareAndSet(false, true)) {
            if (userInitiated) publishStatus(activity.getString(R.string.update_already_checking), true);
            return;
        }

        if (userInitiated) publishStatus(activity.getString(R.string.update_checking), false);
        executor.execute(() -> {
            try {
                UpdateInfo updateInfo = fetchUpdateInfo();
                mainHandler.post(() -> handleUpdateInfo(updateInfo, userInitiated));
            } catch (IOException | JSONException error) {
                if (userInitiated) {
                    mainHandler.post(() -> publishStatus(
                            activity.getString(R.string.update_check_failed),
                            true
                    ));
                }
            } finally {
                checking.set(false);
            }
        });
    }

    void resumePendingInstall() {
        if (destroyed || pendingInstallFile == null || !pendingInstallFile.isFile()) return;
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O
                || activity.getPackageManager().canRequestPackageInstalls()) {
            waitingForInstallPermission = false;
            launchInstaller(pendingInstallFile);
            return;
        }
        if (waitingForInstallPermission) {
            waitingForInstallPermission = false;
            publishStatus(activity.getString(R.string.update_permission_not_enabled), true);
        }
    }

    void destroy() {
        destroyed = true;
        mainHandler.removeCallbacksAndMessages(null);
        if (updateDialog != null) {
            updateDialog.dismiss();
            updateDialog = null;
        }
        executor.shutdownNow();
    }

    private UpdateInfo fetchUpdateInfo() throws IOException, JSONException {
        URL metadataUrl = new URL(
                UPDATE_METADATA_URL
                        + "?installed=" + BuildConfig.VERSION_CODE
                        + "&check=" + System.currentTimeMillis()
        );
        HttpURLConnection connection = (HttpURLConnection) metadataUrl.openConnection();
        connection.setConnectTimeout(10000);
        connection.setReadTimeout(10000);
        connection.setUseCaches(false);
        connection.setRequestProperty("Accept", "application/json");
        connection.setRequestProperty("Cache-Control", "no-cache");
        connection.setRequestProperty(
                "User-Agent",
                "RugareTV/" + BuildConfig.VERSION_NAME + " (Android)"
        );

        try {
            int status = connection.getResponseCode();
            if (status < 200 || status >= 300) {
                throw new IOException("Update metadata returned HTTP " + status);
            }
            String json;
            try (InputStream input = connection.getInputStream()) {
                json = readLimitedText(input, MAX_METADATA_BYTES);
            }
            return parseUpdateInfo(new JSONObject(json));
        } finally {
            connection.disconnect();
        }
    }

    private UpdateInfo parseUpdateInfo(JSONObject json) throws IOException, JSONException {
        String packageName = json.getString("packageName").trim();
        int versionCode = json.getInt("versionCode");
        String versionName = json.getString("versionName").trim();
        String apkUrl = json.getString("apkUrl").trim();
        String sha256 = json.getString("sha256").trim().toUpperCase(Locale.US);
        String releaseNotes = json.optString("releaseNotes", "").trim();

        if (!activity.getPackageName().equals(packageName)) {
            throw new IOException("Update package does not match Rugare TV");
        }
        if (versionCode <= 0 || versionName.isEmpty()) {
            throw new IOException("Update metadata has an invalid version");
        }
        URL parsedApkUrl = new URL(apkUrl);
        if (!"https".equalsIgnoreCase(parsedApkUrl.getProtocol())
                || !UPDATE_HOST.equalsIgnoreCase(parsedApkUrl.getHost())) {
            throw new IOException("Update APK must be hosted on mangezi.xyz over HTTPS");
        }
        if (!sha256.matches("[0-9A-F]{64}")) {
            throw new IOException("Update metadata has an invalid SHA-256 hash");
        }
        return new UpdateInfo(versionCode, versionName, apkUrl, sha256, releaseNotes);
    }

    private void handleUpdateInfo(UpdateInfo updateInfo, boolean userInitiated) {
        if (!canUseActivity()) return;
        if (updateInfo.versionCode <= BuildConfig.VERSION_CODE) {
            if (userInitiated) {
                publishStatus(
                        activity.getString(R.string.update_up_to_date, BuildConfig.VERSION_NAME),
                        true
                );
            }
            return;
        }
        showUpdateDialog(updateInfo);
    }

    private void showUpdateDialog(UpdateInfo updateInfo) {
        if (!canUseActivity()) return;
        if (updateDialog != null && updateDialog.isShowing()) return;

        String message = updateInfo.releaseNotes.isEmpty()
                ? activity.getString(R.string.update_dialog_message)
                : updateInfo.releaseNotes + "\n\n" + activity.getString(R.string.update_dialog_message);
        updateDialog = new AlertDialog.Builder(activity)
                .setTitle(activity.getString(R.string.update_dialog_title, updateInfo.versionName))
                .setMessage(message)
                .setNegativeButton(R.string.update_later, null)
                .setPositiveButton(R.string.update_now, (dialog, which) -> prepareUpdate(updateInfo))
                .create();
        updateDialog.setOnShowListener(dialog -> {
            if (updateDialog != null) {
                updateDialog.getButton(AlertDialog.BUTTON_POSITIVE).requestFocus();
            }
        });
        updateDialog.setOnDismissListener(dialog -> updateDialog = null);
        updateDialog.show();
        publishStatus(
                activity.getString(R.string.update_available, updateInfo.versionName),
                false
        );
    }

    private void prepareUpdate(UpdateInfo updateInfo) {
        if (downloading.get()) {
            publishStatus(activity.getString(R.string.update_downloading), true);
            return;
        }
        File updateFile = getUpdateFile();
        if (updateFile == null) {
            publishStatus(activity.getString(R.string.update_storage_unavailable), true);
            return;
        }
        if (updateFile.isFile()) {
            verifyDownloadedUpdate(updateFile, updateInfo, true);
            return;
        }
        startDownload(updateInfo, updateFile);
    }

    private void startDownload(UpdateInfo updateInfo, File updateFile) {
        if (downloadManager == null || destroyed) {
            publishStatus(activity.getString(R.string.update_download_failed), true);
            return;
        }
        File parent = updateFile.getParentFile();
        if (parent == null || (!parent.isDirectory() && !parent.mkdirs())) {
            publishStatus(activity.getString(R.string.update_storage_unavailable), true);
            return;
        }
        if (updateFile.exists() && !updateFile.delete()) {
            publishStatus(activity.getString(R.string.update_storage_unavailable), true);
            return;
        }

        try {
            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(updateInfo.apkUrl))
                    .setTitle(activity.getString(R.string.update_download_title, updateInfo.versionName))
                    .setDescription(activity.getString(R.string.update_download_description))
                    .setMimeType(APK_MIME_TYPE)
                    .setAllowedOverMetered(true)
                    .setAllowedOverRoaming(true)
                    .setNotificationVisibility(
                            DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED
                    )
                    .setDestinationInExternalFilesDir(
                            activity,
                            Environment.DIRECTORY_DOWNLOADS,
                            UPDATE_FILE_NAME
                    );
            activeDownloadInfo = updateInfo;
            activeDownloadId = downloadManager.enqueue(request);
            downloading.set(true);
            publishStatus(activity.getString(R.string.update_downloading), true);
            scheduleDownloadPoll();
        } catch (RuntimeException error) {
            downloading.set(false);
            publishStatus(activity.getString(R.string.update_download_failed), true);
        }
    }

    private void scheduleDownloadPoll() {
        if (destroyed || !downloading.get()) return;
        mainHandler.postDelayed(
                () -> executor.execute(this::pollDownload),
                DOWNLOAD_POLL_INTERVAL_MS
        );
    }

    private void pollDownload() {
        if (destroyed || !downloading.get() || activeDownloadId < 0L) return;
        int status = DownloadManager.STATUS_FAILED;
        try (Cursor cursor = downloadManager.query(
                new DownloadManager.Query().setFilterById(activeDownloadId)
        )) {
            if (cursor != null && cursor.moveToFirst()) {
                int statusColumn = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS);
                if (statusColumn >= 0) status = cursor.getInt(statusColumn);
            }
        } catch (RuntimeException ignored) {
            status = DownloadManager.STATUS_FAILED;
        }

        if (status == DownloadManager.STATUS_SUCCESSFUL) {
            downloading.set(false);
            File updateFile = getUpdateFile();
            UpdateInfo updateInfo = activeDownloadInfo;
            if (updateFile == null || updateInfo == null) {
                mainHandler.post(() -> publishStatus(
                        activity.getString(R.string.update_download_failed),
                        true
                ));
                return;
            }
            verifyDownloadedUpdate(updateFile, updateInfo, false);
            return;
        }
        if (status == DownloadManager.STATUS_FAILED) {
            downloading.set(false);
            mainHandler.post(() -> publishStatus(
                    activity.getString(R.string.update_download_failed),
                    true
            ));
            return;
        }
        scheduleDownloadPoll();
    }

    private void verifyDownloadedUpdate(
            File updateFile,
            UpdateInfo updateInfo,
            boolean redownloadIfInvalid
    ) {
        executor.execute(() -> {
            try {
                verifyFileHash(updateFile, updateInfo.sha256);
                verifyPackage(updateFile, updateInfo.versionCode);
                pendingInstallFile = updateFile;
                mainHandler.post(() -> requestInstall(updateFile));
            } catch (IOException | PackageManager.NameNotFoundException error) {
                if (updateFile.exists()) updateFile.delete();
                if (redownloadIfInvalid) {
                    mainHandler.post(() -> startDownload(updateInfo, updateFile));
                } else {
                    mainHandler.post(() -> publishStatus(
                            activity.getString(R.string.update_verification_failed),
                            true
                    ));
                }
            }
        });
    }

    private void verifyFileHash(File file, String expectedHash) throws IOException {
        MessageDigest digest;
        try {
            digest = MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException error) {
            throw new IOException("SHA-256 is unavailable", error);
        }
        byte[] buffer = new byte[8192];
        try (InputStream input = new FileInputStream(file)) {
            int count;
            while ((count = input.read(buffer)) != -1) digest.update(buffer, 0, count);
        }
        if (!toHex(digest.digest()).equalsIgnoreCase(expectedHash)) {
            throw new IOException("Downloaded APK hash does not match update metadata");
        }
    }

    @SuppressWarnings("deprecation")
    private void verifyPackage(File file, int expectedVersionCode)
            throws IOException, PackageManager.NameNotFoundException {
        PackageManager packageManager = activity.getPackageManager();
        int signatureFlags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                ? PackageManager.GET_SIGNING_CERTIFICATES
                : PackageManager.GET_SIGNATURES;
        PackageInfo archive = packageManager.getPackageArchiveInfo(
                file.getAbsolutePath(),
                signatureFlags
        );
        if (archive == null || !activity.getPackageName().equals(archive.packageName)) {
            throw new IOException("Downloaded APK package name does not match Rugare TV");
        }
        long archiveVersionCode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                ? archive.getLongVersionCode()
                : archive.versionCode;
        if (archiveVersionCode != expectedVersionCode
                || archiveVersionCode <= BuildConfig.VERSION_CODE) {
            throw new IOException("Downloaded APK version does not match update metadata");
        }

        PackageInfo installed = packageManager.getPackageInfo(
                activity.getPackageName(),
                signatureFlags
        );
        Set<String> archiveSigners = signerFingerprints(archive);
        Set<String> installedSigners = signerFingerprints(installed);
        archiveSigners.retainAll(installedSigners);
        if (archiveSigners.isEmpty()) {
            throw new IOException("Downloaded APK is not signed by the installed Rugare TV key");
        }
    }

    @SuppressWarnings("deprecation")
    private Set<String> signerFingerprints(PackageInfo packageInfo) throws IOException {
        Signature[] signatures;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            if (packageInfo.signingInfo == null) return new HashSet<>();
            signatures = packageInfo.signingInfo.hasMultipleSigners()
                    ? packageInfo.signingInfo.getApkContentsSigners()
                    : packageInfo.signingInfo.getSigningCertificateHistory();
        } else {
            signatures = packageInfo.signatures;
        }

        Set<String> fingerprints = new HashSet<>();
        if (signatures == null) return fingerprints;
        for (Signature signature : signatures) {
            try {
                MessageDigest digest = MessageDigest.getInstance("SHA-256");
                fingerprints.add(toHex(digest.digest(signature.toByteArray())));
            } catch (NoSuchAlgorithmException error) {
                throw new IOException("SHA-256 is unavailable", error);
            }
        }
        return fingerprints;
    }

    private void requestInstall(File updateFile) {
        if (!canUseActivity()) return;
        pendingInstallFile = updateFile;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && !activity.getPackageManager().canRequestPackageInstalls()) {
            try {
                waitingForInstallPermission = true;
                Intent settingsIntent = new Intent(
                        Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + activity.getPackageName())
                );
                activity.startActivity(settingsIntent);
                publishStatus(activity.getString(R.string.update_enable_permission), true);
            } catch (ActivityNotFoundException error) {
                waitingForInstallPermission = false;
                publishStatus(activity.getString(R.string.update_installer_unavailable), true);
            }
            return;
        }
        launchInstaller(updateFile);
    }

    private void launchInstaller(File updateFile) {
        if (!canUseActivity()) return;
        try {
            Uri apkUri = FileProvider.getUriForFile(
                    activity,
                    activity.getPackageName() + ".files",
                    updateFile
            );
            Intent installIntent = new Intent(Intent.ACTION_VIEW)
                    .setDataAndType(apkUri, APK_MIME_TYPE)
                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
            activity.startActivity(installIntent);
            pendingInstallFile = null;
            publishStatus(activity.getString(R.string.update_ready_to_install), false);
        } catch (ActivityNotFoundException | IllegalArgumentException error) {
            publishStatus(activity.getString(R.string.update_installer_unavailable), true);
        }
    }

    private File getUpdateFile() {
        File downloads = activity.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        return downloads == null ? null : new File(downloads, UPDATE_FILE_NAME);
    }

    private boolean canUseActivity() {
        return !destroyed && !activity.isFinishing() && !activity.isDestroyed();
    }

    private void publishStatus(String message, boolean toast) {
        if (destroyed || message == null || message.trim().isEmpty()) return;
        mainHandler.post(() -> {
            if (!canUseActivity()) return;
            listener.onStatus(message);
            if (toast) Toast.makeText(activity, message, Toast.LENGTH_LONG).show();
        });
    }

    private static String readLimitedText(InputStream input, int limit) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[4096];
        int total = 0;
        int count;
        while ((count = input.read(buffer)) != -1) {
            total += count;
            if (total > limit) throw new IOException("Update metadata is too large");
            output.write(buffer, 0, count);
        }
        return output.toString(StandardCharsets.UTF_8.name());
    }

    private static String toHex(byte[] bytes) {
        StringBuilder output = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) output.append(String.format(Locale.US, "%02X", value));
        return output.toString();
    }

    private static final class UpdateInfo {
        final int versionCode;
        final String versionName;
        final String apkUrl;
        final String sha256;
        final String releaseNotes;

        UpdateInfo(
                int versionCode,
                String versionName,
                String apkUrl,
                String sha256,
                String releaseNotes
        ) {
            this.versionCode = versionCode;
            this.versionName = versionName;
            this.apkUrl = apkUrl;
            this.sha256 = sha256;
            this.releaseNotes = releaseNotes;
        }
    }
}
