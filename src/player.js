export function createPlayer(videoEl, { HlsCtor = (typeof window !== 'undefined' ? window.Hls : undefined) } = {}) {
  let hls = null;
  let nativeErrorListener = null;
  let errorHandler = () => {};
  let playSession = 0;

  function onError(handler) {
    errorHandler = handler;
  }

  function destroy() {
    playSession += 1;
    cleanupPlayback();
  }

  function cleanupPlayback() {
    if (hls) {
      hls.destroy();
      hls = null;
    }
    if (nativeErrorListener) {
      videoEl.removeEventListener('error', nativeErrorListener);
      nativeErrorListener = null;
    }
    videoEl.removeAttribute('src');
    videoEl.load?.();
  }

  function play(sources) {
    playSession += 1;
    const session = playSession;
    const urls = normalizeSources(sources);
    cleanupPlayback();

    if (!urls.length) {
      errorHandler(new Error('No stream URL is available for this channel'));
      return;
    }

    trySource(urls, 0, session, []);
  }

  function trySource(urls, index, session, errors) {
    if (session !== playSession) return;
    if (index >= urls.length) {
      const lastError = errors[errors.length - 1];
      errorHandler(lastError || new Error('No playable stream source was found'));
      return;
    }

    const url = urls[index];
    tryNativeThenHls(url, session, (error) => {
      trySource(urls, index + 1, session, [...errors, error]);
    });
  }

  function tryNativeThenHls(url, session, next) {
    if (canPlayNativeHls()) {
      playNative(url, session, (nativeError) => {
        if (HlsCtor && HlsCtor.isSupported()) {
          playWithHls(url, session, (hlsError) => next(hlsError || nativeError));
          return;
        }
        next(nativeError);
      });
      return;
    }

    if (HlsCtor && HlsCtor.isSupported()) {
      playWithHls(url, session, next);
      return;
    }

    next(new Error('HLS playback is not supported in this browser'));
  }

  function canPlayNativeHls() {
    return ['application/vnd.apple.mpegurl', 'application/x-mpegURL', 'audio/x-mpegurl']
      .some((type) => Boolean(videoEl.canPlayType(type)));
  }

  function playNative(url, session, onFailure) {
    let failed = false;

    const fail = (error) => {
      if (failed || session !== playSession) return;
      failed = true;
      if (nativeErrorListener) {
        videoEl.removeEventListener('error', nativeErrorListener);
        nativeErrorListener = null;
      }
      onFailure(error);
    };

    videoEl.src = url;
    nativeErrorListener = () => fail(new Error('Native playback failed'));
    videoEl.addEventListener('error', nativeErrorListener, { once: true });
    videoEl.play().catch(fail);
  }

  function playWithHls(url, session, onFailure) {
    cleanupPlayback();

    let recoveredNetworkError = false;
    let recoveredMediaError = false;
    let failed = false;

    const fail = (error) => {
      if (failed || session !== playSession) return;
      failed = true;
      cleanupPlayback();
      onFailure(error);
    };

    hls = new HlsCtor();
    hls.on(HlsCtor.Events.ERROR, (_event, data) => {
      if (!data || !data.fatal) return;

      if (isNetworkError(data) && !recoveredNetworkError && typeof hls.startLoad === 'function') {
        recoveredNetworkError = true;
        hls.startLoad();
        return;
      }

      if (isMediaError(data) && !recoveredMediaError && typeof hls.recoverMediaError === 'function') {
        recoveredMediaError = true;
        hls.recoverMediaError();
        return;
      }

      fail(new Error(data.details || 'HLS playback failed'));
    });
    hls.on(HlsCtor.Events.MANIFEST_PARSED, () => {
      videoEl.play().catch(fail);
    });
    hls.loadSource(url);
    hls.attachMedia(videoEl);
  }

  function normalizeSources(sources) {
    const urls = Array.isArray(sources) ? sources : [sources];
    return [...new Set(urls.filter(Boolean).map((url) => String(url).trim()).filter(Boolean))];
  }

  function isNetworkError(data) {
    return data.type === HlsCtor.ErrorTypes?.NETWORK_ERROR || data.type === 'networkError';
  }

  function isMediaError(data) {
    return data.type === HlsCtor.ErrorTypes?.MEDIA_ERROR || data.type === 'mediaError';
  }

  return { play, onError, destroy };
}
