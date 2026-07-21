export function createPlayer(videoEl, { HlsCtor = (typeof window !== 'undefined' ? window.Hls : undefined) } = {}) {
  let hls = null;
  let nativeErrorListener = null;
  let errorHandler = () => {};

  function onError(handler) {
    errorHandler = handler;
  }

  function destroy() {
    if (hls) {
      hls.destroy();
      hls = null;
    }
    if (nativeErrorListener) {
      videoEl.removeEventListener('error', nativeErrorListener);
      nativeErrorListener = null;
    }
  }

  function play(url) {
    destroy();
    videoEl.removeAttribute('src');

    if (canPlayNativeHls()) {
      playNative(url);
      return;
    }

    if (HlsCtor && HlsCtor.isSupported()) {
      hls = new HlsCtor();
      hls.on(HlsCtor.Events.ERROR, (_event, data) => {
        if (data && data.fatal) {
          errorHandler(new Error(data.details || 'Playback failed'));
        }
      });
      hls.on(HlsCtor.Events.MANIFEST_PARSED, () => {
        videoEl.play().catch((err) => errorHandler(err));
      });
      hls.loadSource(url);
      hls.attachMedia(videoEl);
      return;
    }

    errorHandler(new Error('HLS playback is not supported in this browser'));
  }

  function canPlayNativeHls() {
    return ['application/vnd.apple.mpegurl', 'application/x-mpegURL', 'audio/x-mpegurl']
      .some((type) => Boolean(videoEl.canPlayType(type)));
  }

  function playNative(url) {
    videoEl.src = url;
    nativeErrorListener = () => errorHandler(new Error('Playback failed'));
    videoEl.addEventListener('error', nativeErrorListener, { once: true });
    videoEl.play().catch((err) => errorHandler(err));
  }

  return { play, onError, destroy };
}
