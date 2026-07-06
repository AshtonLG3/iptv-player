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

    if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      videoEl.src = url;
      nativeErrorListener = () => errorHandler(new Error('Playback failed'));
      videoEl.addEventListener('error', nativeErrorListener, { once: true });
      videoEl.play().catch((err) => errorHandler(err));
      return;
    }

    errorHandler(new Error('HLS playback is not supported in this browser'));
  }

  return { play, onError, destroy };
}
