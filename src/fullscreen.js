function invoke(receiver, methodName) {
  return Promise.resolve(receiver[methodName]());
}

export function createFullscreenController({ documentObj, playerElement, videoElement }) {
  function isActive() {
    return Boolean(
      documentObj.fullscreenElement
      || documentObj.webkitFullscreenElement
      || videoElement.webkitDisplayingFullscreen,
    );
  }

  function isSupported() {
    return Boolean(
      playerElement.requestFullscreen
      || playerElement.webkitRequestFullscreen
      || videoElement.webkitEnterFullscreen,
    );
  }

  async function toggle() {
    if (isActive()) {
      if (documentObj.exitFullscreen) {
        await invoke(documentObj, 'exitFullscreen');
      } else if (documentObj.webkitExitFullscreen) {
        await invoke(documentObj, 'webkitExitFullscreen');
      } else if (videoElement.webkitExitFullscreen) {
        await invoke(videoElement, 'webkitExitFullscreen');
      }
      return false;
    }

    if (playerElement.requestFullscreen) {
      await invoke(playerElement, 'requestFullscreen');
      return true;
    }
    if (playerElement.webkitRequestFullscreen) {
      await invoke(playerElement, 'webkitRequestFullscreen');
      return true;
    }
    if (videoElement.webkitEnterFullscreen) {
      await invoke(videoElement, 'webkitEnterFullscreen');
      return true;
    }
    return false;
  }

  return { isActive, isSupported, toggle };
}
