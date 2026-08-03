package com.mangezi.ftaiptv;

import android.app.Activity;
import android.app.UiModeManager;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceError;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URISyntaxException;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;

/** Isolated browser for official broadcaster and YouTube pages. */
public final class InAppBrowserActivity extends Activity {
    private static final String EXTRA_URL = "url";
    private static final String EXTRA_FULLSCREEN_PLAYBACK = "fullscreen_playback";
    private static final String YOUTUBE_EMBED = "https://www.youtube.com/embed/";
    private static final String YOUTUBE_PLAYLIST =
            "https://www.youtube.com/embed/videoseries?playsinline=1&autoplay=1&list=";
    private static final String PAUSE_WEB_MEDIA_SCRIPT =
            "(function(){try{"
                    + "document.querySelectorAll('video,audio').forEach(function(media){"
                    + "media.pause();media.muted=true;"
                    + "});"
                    + "}catch(error){}return true;})()";

    private FrameLayout root;
    private LinearLayout browserShell;
    private LinearLayout toolbar;
    private ProgressBar progressBar;
    private TextView titleView;
    private WebView webView;
    private View customView;
    private WebChromeClient.CustomViewCallback customViewCallback;
    private boolean televisionDevice;
    private boolean toolbarVisible;
    private boolean fullscreenPlayback;
    private String externalUrl;
    private String remoteNavigationScript;

    public static void open(Context context, String url) {
        open(context, url, false);
    }

    public static void open(Context context, String url, boolean fullscreenPlayback) {
        if (!isHttpUrl(url)) return;
        Intent intent = new Intent(context, InAppBrowserActivity.class);
        intent.putExtra(EXTRA_URL, url);
        intent.putExtra(EXTRA_FULLSCREEN_PLAYBACK, fullscreenPlayback);
        context.startActivity(intent);
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        televisionDevice = detectTelevisionDevice();
        fullscreenPlayback = getIntent().getBooleanExtra(EXTRA_FULLSCREEN_PLAYBACK, false);
        toolbarVisible = !televisionDevice && !fullscreenPlayback;
        if (fullscreenPlayback) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
            enterImmersiveMode();
        }
        buildLayout();
        createWebView();

        String initialUrl = getIntent().getStringExtra(EXTRA_URL);
        if (!isHttpUrl(initialUrl)) {
            finish();
            return;
        }
        externalUrl = initialUrl;
        webView.loadUrl(normalizeUrl(initialUrl));
    }

    private void buildLayout() {
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);
        getWindow().setStatusBarColor(Color.rgb(18, 20, 26));
        getWindow().setNavigationBarColor(Color.rgb(18, 20, 26));

        browserShell = new LinearLayout(this);
        browserShell.setOrientation(LinearLayout.VERTICAL);
        browserShell.setBackgroundColor(Color.BLACK);
        root.addView(browserShell, matchParentLayoutParams());
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            browserShell.setPadding(0, fullscreenPlayback ? 0 : getTopInset(insets), 0, 0);
            return insets;
        });

        toolbar = new LinearLayout(this);
        toolbar.setOrientation(LinearLayout.HORIZONTAL);
        toolbar.setGravity(Gravity.CENTER_VERTICAL);
        toolbar.setPadding(dp(4), 0, dp(4), 0);
        toolbar.setBackgroundColor(Color.rgb(18, 20, 26));
        toolbar.setElevation(dp(3));
        browserShell.addView(toolbar, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                dp(48)
        ));

        toolbar.addView(createToolbarAction("Done", "Close official service", view -> finish()));

        titleView = new TextView(this);
        titleView.setText(getString(R.string.official_stream));
        titleView.setTextColor(Color.rgb(238, 241, 246));
        titleView.setTextSize(16);
        titleView.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        titleView.setGravity(Gravity.CENTER);
        titleView.setSingleLine(true);
        titleView.setEllipsize(android.text.TextUtils.TruncateAt.END);
        titleView.setPadding(dp(8), 0, dp(8), 0);
        toolbar.addView(titleView, new LinearLayout.LayoutParams(0, dp(48), 1));

        toolbar.addView(createToolbarAction(
                "Browsers",
                "Choose a browser for this official service",
                view -> openExternally()
        ));

        progressBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progressBar.setMax(100);
        browserShell.addView(progressBar, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                dp(2)
        ));
        setToolbarVisible(toolbarVisible);
        setContentView(root);
    }

    private TextView createToolbarAction(
            String label,
            String description,
            View.OnClickListener listener
    ) {
        TextView action = new TextView(this);
        action.setText(label);
        action.setTextColor(Color.rgb(91, 183, 255));
        action.setTextSize(15);
        action.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        action.setGravity(Gravity.CENTER);
        action.setMinWidth(dp(64));
        action.setPadding(dp(12), 0, dp(12), 0);
        action.setContentDescription(description);
        action.setBackgroundResource(android.R.drawable.list_selector_background);
        action.setOnClickListener(listener);
        action.setFocusable(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            action.setTooltipText(description);
        }
        return action;
    }

    @SuppressWarnings("deprecation")
    private int getTopInset(WindowInsets insets) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            return insets.getInsets(WindowInsets.Type.statusBars()).top;
        }
        return insets.getSystemWindowInsetTop();
    }

    private void createWebView() {
        webView = new WebView(this);
        webView.setBackgroundColor(Color.BLACK);
        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            webView.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, true);
        }

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        String userAgent = settings.getUserAgentString();
        if (userAgent != null) {
            settings.setUserAgentString(userAgent.replace("; wv", ""));
        }
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(webView, true);

        webView.setWebViewClient(new BrowserClient());
        webView.setWebChromeClient(new BrowserChromeClient());
        browserShell.addView(webView, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                0,
                1
        ));
        if (webView != null) webView.requestFocus();
    }

    private final class BrowserClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            return handleNavigation(view, request.getUrl(), request.isForMainFrame());
        }

        @SuppressWarnings("deprecation")
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            return handleNavigation(view, Uri.parse(url), true);
        }

        private boolean handleNavigation(WebView view, Uri uri, boolean mainFrame) {
            String scheme = uri.getScheme();
            if ("intent".equalsIgnoreCase(scheme)) {
                openIntentFallback(uri.toString());
                return true;
            }
            if (!isHttpScheme(scheme)) return true;

            String requestedUrl = uri.toString();
            if (mainFrame) externalUrl = requestedUrl;
            String normalizedUrl = normalizeUrl(requestedUrl);
            if (!normalizedUrl.equals(requestedUrl)) {
                view.loadUrl(normalizedUrl);
                return true;
            }
            return false;
        }

        @Override
        public void onReceivedError(
                WebView view,
                WebResourceRequest request,
                WebResourceError error
        ) {
            if (request.isForMainFrame()) {
                Toast.makeText(
                        InAppBrowserActivity.this,
                        getString(R.string.page_failed_to_load),
                        Toast.LENGTH_SHORT
                ).show();
            }
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            super.onPageFinished(view, url);
            installRemoteNavigation(view);
            if (fullscreenPlayback) enterImmersiveMode();
        }

        @Override
        public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
            if (view != webView) return false;
            browserShell.removeView(view);
            view.destroy();
            webView = null;
            Toast.makeText(
                    InAppBrowserActivity.this,
                    getString(R.string.browser_closed_after_error),
                    Toast.LENGTH_SHORT
            ).show();
            finish();
            return true;
        }
    }

    private final class BrowserChromeClient extends WebChromeClient {
        @Override
        public void onProgressChanged(WebView view, int newProgress) {
            progressBar.setProgress(newProgress);
            progressBar.setVisibility(newProgress >= 100 ? View.GONE : View.VISIBLE);
        }

        @Override
        public void onReceivedTitle(WebView view, String title) {
            if (title != null && !title.trim().isEmpty()) titleView.setText(title);
        }

        @Override
        public void onShowCustomView(View view, CustomViewCallback callback) {
            if (customView != null) {
                callback.onCustomViewHidden();
                return;
            }
            customView = view;
            customViewCallback = callback;
            browserShell.setVisibility(View.GONE);
            root.addView(view, matchParentLayoutParams());
            enterImmersiveMode();
            if (!televisionDevice) {
                setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
            }
        }

        @Override
        public void onHideCustomView() {
            hideCustomView();
        }

        @Override
        public void onPermissionRequest(PermissionRequest request) {
            runOnUiThread(() -> {
                for (String resource : request.getResources()) {
                    if (PermissionRequest.RESOURCE_PROTECTED_MEDIA_ID.equals(resource)) {
                        request.grant(new String[]{PermissionRequest.RESOURCE_PROTECTED_MEDIA_ID});
                        return;
                    }
                }
                request.deny();
            });
        }
    }

    private void hideCustomView() {
        if (customView == null) return;
        root.removeView(customView);
        customView = null;
        browserShell.setVisibility(View.VISIBLE);
        if (customViewCallback != null) {
            customViewCallback.onCustomViewHidden();
            customViewCallback = null;
        }
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
        if (!televisionDevice && !fullscreenPlayback) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
        }
        setToolbarVisible(toolbarVisible);
        if (fullscreenPlayback) enterImmersiveMode();
        if (webView != null) webView.requestFocus();
    }

    private void enterImmersiveMode() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        );
    }

    private void openIntentFallback(String url) {
        try {
            Intent intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME);
            String fallbackUrl = intent.getStringExtra("browser_fallback_url");
            if (isHttpUrl(fallbackUrl)) {
                externalUrl = fallbackUrl;
                webView.loadUrl(normalizeUrl(fallbackUrl));
            }
        } catch (URISyntaxException ignored) {
            // Ignore app-only deep links; the explicit toolbar action is the external fallback.
        }
    }

    private void openExternally() {
        if (!isHttpUrl(externalUrl)) return;
        pauseWebMediaThen(() -> {
            try {
                Intent browserIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(externalUrl));
                browserIntent.addCategory(Intent.CATEGORY_BROWSABLE);
                startActivity(Intent.createChooser(
                        browserIntent,
                        getString(R.string.choose_browser)
                ));
                finish();
            } catch (ActivityNotFoundException ignored) {
                Toast.makeText(this, getString(R.string.no_compatible_app), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void pauseWebMediaThen(Runnable nextAction) {
        if (webView == null) {
            nextAction.run();
            return;
        }

        AtomicBoolean completed = new AtomicBoolean(false);
        Runnable continueOnce = () -> {
            if (completed.compareAndSet(false, true)) nextAction.run();
        };
        webView.evaluateJavascript(PAUSE_WEB_MEDIA_SCRIPT, ignored -> continueOnce.run());
        webView.postDelayed(continueOnce, 350);
    }

    private void pauseWebMedia() {
        if (webView != null) webView.evaluateJavascript(PAUSE_WEB_MEDIA_SCRIPT, null);
    }

    private void navigateBack() {
        if (customView != null) {
            hideCustomView();
        } else if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            finish();
        }
    }

    private void installRemoteNavigation(WebView view) {
        if (view == null) return;
        if (remoteNavigationScript == null) {
            remoteNavigationScript = readRawResource(R.raw.tv_remote_navigation);
        }
        if (remoteNavigationScript == null || remoteNavigationScript.trim().isEmpty()) return;
        String configuration = "\n;if(window.__rugareTvRemote){"
                + "window.__rugareTvRemote.configure({sporty:"
                + (fullscreenPlayback ? "true" : "false")
                + ",unmute:"
                + (isZbcUrl(view.getUrl()) ? "true" : "false")
                + "});}";
        view.evaluateJavascript(remoteNavigationScript + configuration, null);
    }

    private String readRawResource(int resourceId) {
        try (InputStream input = getResources().openRawResource(resourceId);
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096];
            int count;
            while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
            return output.toString(StandardCharsets.UTF_8.name());
        } catch (IOException ignored) {
            return null;
        }
    }

    private void runRemoteCommand(String command) {
        if (webView == null
                || command == null
                || !command.matches("[A-Za-z]+(?:\\(\\)|\\('[a-z]+'\\))")) {
            return;
        }
        webView.evaluateJavascript(
                "if(window.__rugareTvRemote){window.__rugareTvRemote." + command + ";}",
                null
        );
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (televisionDevice
                && event.getAction() == KeyEvent.ACTION_DOWN
                && event.getKeyCode() == KeyEvent.KEYCODE_MENU
                && customView == null) {
            setToolbarVisible(!toolbarVisible);
            if (toolbarVisible) {
                toolbar.getChildAt(0).requestFocus();
            } else if (webView != null) {
                webView.requestFocus();
            }
            return true;
        }

        if (event.getAction() == KeyEvent.ACTION_DOWN
                && customView == null
                && webView != null
                && webView.hasFocus()) {
            switch (event.getKeyCode()) {
                case KeyEvent.KEYCODE_DPAD_UP:
                    runRemoteCommand("move('up')");
                    return true;
                case KeyEvent.KEYCODE_DPAD_DOWN:
                    runRemoteCommand("move('down')");
                    return true;
                case KeyEvent.KEYCODE_DPAD_LEFT:
                    runRemoteCommand("move('left')");
                    return true;
                case KeyEvent.KEYCODE_DPAD_RIGHT:
                    runRemoteCommand("move('right')");
                    return true;
                case KeyEvent.KEYCODE_DPAD_CENTER:
                case KeyEvent.KEYCODE_ENTER:
                case KeyEvent.KEYCODE_NUMPAD_ENTER:
                case KeyEvent.KEYCODE_BUTTON_A:
                    runRemoteCommand("activate()");
                    return true;
                case KeyEvent.KEYCODE_PAGE_UP:
                case KeyEvent.KEYCODE_CHANNEL_UP:
                    runRemoteCommand("page('up')");
                    return true;
                case KeyEvent.KEYCODE_PAGE_DOWN:
                case KeyEvent.KEYCODE_CHANNEL_DOWN:
                    runRemoteCommand("page('down')");
                    return true;
                case KeyEvent.KEYCODE_MEDIA_PLAY:
                case KeyEvent.KEYCODE_MEDIA_PAUSE:
                case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:
                    runRemoteCommand("playPause()");
                    return true;
                default:
                    break;
            }
        }
        return super.dispatchKeyEvent(event);
    }

    @Override
    public void onBackPressed() {
        navigateBack();
    }

    @Override
    protected void onPause() {
        pauseWebMedia();
        if (webView != null) webView.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
        if (fullscreenPlayback) enterImmersiveMode();
    }

    @Override
    protected void onDestroy() {
        hideCustomView();
        if (webView != null) {
            webView.stopLoading();
            browserShell.removeView(webView);
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    private void setToolbarVisible(boolean visible) {
        toolbarVisible = visible;
        if (toolbar == null || progressBar == null) return;
        toolbar.setVisibility(visible ? View.VISIBLE : View.GONE);
        if (!visible) progressBar.setVisibility(View.GONE);
    }

    private boolean detectTelevisionDevice() {
        UiModeManager uiModeManager = (UiModeManager) getSystemService(Context.UI_MODE_SERVICE);
        boolean televisionMode = uiModeManager != null
                && uiModeManager.getCurrentModeType() == Configuration.UI_MODE_TYPE_TELEVISION;
        PackageManager packageManager = getPackageManager();
        return televisionMode
                || packageManager.hasSystemFeature(PackageManager.FEATURE_LEANBACK)
                || packageManager.hasSystemFeature(PackageManager.FEATURE_TELEVISION);
    }

    private static String normalizeUrl(String rawUrl) {
        Uri uri = Uri.parse(rawUrl);
        String host = uri.getHost();
        if (host == null) return rawUrl;
        host = host.toLowerCase(Locale.US);
        if (host.startsWith("www.")) host = host.substring(4);
        if (host.startsWith("m.")) host = host.substring(2);

        String videoId = null;
        if ("youtu.be".equals(host)) {
            videoId = firstPathSegment(uri);
        } else if ("youtube.com".equals(host)) {
            String path = uri.getPath() == null ? "" : uri.getPath();
            if ("/watch".equals(path)) {
                videoId = uri.getQueryParameter("v");
            } else if (path.startsWith("/live/") || path.startsWith("/shorts/")) {
                videoId = pathSegment(uri, 1);
            } else if ("/playlist".equals(path)) {
                String playlistId = safeYouTubeId(uri.getQueryParameter("list"));
                if (playlistId != null) return YOUTUBE_PLAYLIST + playlistId;
            }
        }

        videoId = safeYouTubeId(videoId);
        if (videoId == null) return rawUrl;
        return YOUTUBE_EMBED + videoId + "?playsinline=1&autoplay=1";
    }

    private static String firstPathSegment(Uri uri) {
        return pathSegment(uri, 0);
    }

    private static String pathSegment(Uri uri, int index) {
        return uri.getPathSegments().size() > index ? uri.getPathSegments().get(index) : null;
    }

    private static String safeYouTubeId(String value) {
        if (value == null || !value.matches("[A-Za-z0-9_-]{6,}")) return null;
        return value;
    }

    private static boolean isHttpUrl(String url) {
        if (url == null) return false;
        return isHttpScheme(Uri.parse(url).getScheme());
    }

    private static boolean isHttpScheme(String scheme) {
        return "http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme);
    }

    private static boolean isZbcUrl(String url) {
        if (!isHttpUrl(url)) return false;
        String host = Uri.parse(url).getHost();
        if (host == null) return false;
        host = host.toLowerCase(Locale.US);
        return "zbc.ottplatform.com".equals(host) || host.endsWith(".zbc.ottplatform.com");
    }

    private FrameLayout.LayoutParams matchParentLayoutParams() {
        return new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        );
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
