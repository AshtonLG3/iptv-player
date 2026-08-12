(function () {
  'use strict';

  if (window.__rugareTvForceUnmute) return;
  window.__rugareTvForceUnmute = { version: 1 };

  function unmuteMedia(media) {
    if (!media || (media.tagName !== 'VIDEO' && media.tagName !== 'AUDIO')) return;
    try {
      media.removeAttribute('muted');
      media.defaultMuted = false;
      if (media.muted) media.muted = false;
      if (!Number.isFinite(media.volume) || media.volume < 0.95) media.volume = 1;
    } catch (_error) {}
  }

  function messageEmbeddedPlayers() {
    Array.prototype.forEach.call(document.querySelectorAll('iframe'), function (frame) {
      if (!frame.contentWindow) return;
      try {
        frame.contentWindow.postMessage({
          _method: 'unmute',
          player: 'mango_player',
          parameter: ''
        }, '*');
        frame.contentWindow.postMessage(JSON.stringify({
          context: 'player.js',
          version: '0.0.11',
          method: 'unmute'
        }), '*');
        frame.contentWindow.postMessage({ method: 'setVolume', value: 1 }, '*');
        frame.contentWindow.postMessage({
          event: 'command',
          func: 'unMute',
          args: []
        }, '*');
      } catch (_error) {}
    });
  }

  function mutedControl(control) {
    if (!control || !control.classList) return false;
    var classes = String(control.className || '');
    var label = [control.getAttribute('aria-label'), control.getAttribute('title')]
      .filter(Boolean)
      .join(' ');
    if (/\b(?:unmute|turn on sound|sound on)\b/i.test(label)) return true;
    if (/bmpui-ui-volumetogglebutton/.test(classes)) {
      return control.classList.contains('bmpui-on') || control.classList.contains('muted');
    }
    if (/vjs-mute-control/.test(classes)) return control.classList.contains('vjs-vol-0');
    if (/jw-icon-volume/.test(classes)) return control.classList.contains('jw-off');
    return false;
  }

  function activateMutedControls() {
    Array.prototype.forEach.call(document.querySelectorAll([
      '.bmpui-ui-volumetogglebutton',
      '.vjs-mute-control',
      '.jw-icon-volume',
      '[aria-label]',
      '[title]'
    ].join(',')), function (control) {
      if (!mutedControl(control) || typeof control.click !== 'function') return;
      var now = Date.now();
      var lastClick = Number(control.getAttribute('data-rugare-unmute-click') || 0);
      if (now - lastClick < 1000) return;
      control.setAttribute('data-rugare-unmute-click', String(now));
      control.click();
    });
  }

  function forceUnmute() {
    Array.prototype.forEach.call(document.querySelectorAll('video,audio'), unmuteMedia);
    messageEmbeddedPlayers();
    activateMutedControls();
  }

  function hookMediaProperty(property, replacement) {
    if (!window.HTMLMediaElement || !window.HTMLMediaElement.prototype) return;
    var prototype = window.HTMLMediaElement.prototype;
    var descriptor = Object.getOwnPropertyDescriptor(prototype, property);
    if (!descriptor || !descriptor.configurable || !descriptor.get || !descriptor.set) return;
    try {
      Object.defineProperty(prototype, property, {
        configurable: descriptor.configurable,
        enumerable: descriptor.enumerable,
        get: descriptor.get,
        set: function (value) {
          descriptor.set.call(this, value);
          if (replacement(value)) {
            var media = this;
            Promise.resolve().then(function () { unmuteMedia(media); });
          }
        }
      });
    } catch (_error) {}
  }

  hookMediaProperty('muted', function (value) { return Boolean(value); });
  hookMediaProperty('volume', function (value) { return Number(value) < 0.95; });
  document.addEventListener('play', function (event) { unmuteMedia(event.target); }, true);
  document.addEventListener('loadedmetadata', function (event) { unmuteMedia(event.target); }, true);

  function start() {
    forceUnmute();
    if (document.documentElement) {
      new MutationObserver(forceUnmute).observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'muted']
      });
    }
    window.setInterval(forceUnmute, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
