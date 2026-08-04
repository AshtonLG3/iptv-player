(function () {
  'use strict';

  var CONTROLLER_VERSION = 8;
  var FOCUS_CLASS = 'rugare-tv-remote-focus';
  var PLAYER_CLASS = 'rugare-tv-player-shell';
  var activeElement = null;
  var activeSignature = '';
  var activePoint = null;
  var selectAdjustmentElement = null;
  var sportyMode = false;
  var unmuteMode = false;
  var refreshTimer = 0;

  if (window.__rugareTvRemote && window.__rugareTvRemote.version >= CONTROLLER_VERSION) {
    window.__rugareTvRemote.refresh();
    return;
  }

  function addStyles() {
    if (document.getElementById('rugare-tv-remote-style')) return;
    var style = document.createElement('style');
    style.id = 'rugare-tv-remote-style';
    style.textContent = [
      '.' + FOCUS_CLASS + ' {',
      '  outline: 5px solid #ffb000 !important;',
      '  outline-offset: 4px !important;',
      '  box-shadow: 0 0 0 4px rgba(0,0,0,.72) !important;',
      '}',
      '.rugare-tv-select-adjusting {',
      '  outline-color: #35e36f !important;',
      '  box-shadow: 0 0 0 4px rgba(0,0,0,.72), 0 0 22px rgba(53,227,111,.9) !important;',
      '}',
      'html.rugare-sporty-full, html.rugare-sporty-full body {',
      '  background: #000 !important;',
      '  height: 100% !important;',
      '  margin: 0 !important;',
      '  overflow: hidden !important;',
      '  padding: 0 !important;',
      '  width: 100% !important;',
      '}',
      'html.rugare-sporty-full body header,',
      'html.rugare-sporty-full body footer { display: none !important; }',
      'html.rugare-sporty-full .' + PLAYER_CLASS + ' {',
      '  background: #000 !important;',
      '  inset: 0 !important;',
      '  height: 100vh !important;',
      '  margin: 0 !important;',
      '  max-height: none !important;',
      '  max-width: none !important;',
      '  padding: 0 !important;',
      '  position: fixed !important;',
      '  width: 100vw !important;',
      '  z-index: 2147483000 !important;',
      '}',
      'html.rugare-sporty-full .' + PLAYER_CLASS + ' video,',
      'html.rugare-sporty-full .' + PLAYER_CLASS + ' iframe {',
      '  background: #000 !important;',
      '  border: 0 !important;',
      '  height: 100% !important;',
      '  inset: 0 !important;',
      '  max-height: none !important;',
      '  max-width: none !important;',
      '  object-fit: contain !important;',
      '  position: absolute !important;',
      '  width: 100% !important;',
      '}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(style);
  }

  function isVisible(element) {
    if (!element || !element.isConnected) return false;
    if (element.disabled || element.getAttribute('aria-disabled') === 'true') return false;
    var style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
      return false;
    }
    var rect = element.getBoundingClientRect();
    return rect.width >= 2 && rect.height >= 2;
  }

  function reactProps(element) {
    if (!element) return null;
    var propsKey = Object.keys(element).find(function (key) {
      return key.indexOf('__reactProps') === 0;
    });
    return propsKey ? element[propsKey] : null;
  }

  function hasClickHandler(element) {
    var props = reactProps(element);
    return Boolean(element && typeof element.onclick === 'function')
      || Boolean(props && (
        typeof props.onClick === 'function'
        || typeof props.onPointerUp === 'function'
        || typeof props.onMouseUp === 'function'
      ));
  }

  function isReachable(element) {
    var rect = element.getBoundingClientRect();
    if (!viewportIntersects(rect)) return true;
    var x = Math.max(0, Math.min(window.innerWidth - 1, rect.left + rect.width / 2));
    var y = Math.max(0, Math.min(window.innerHeight - 1, rect.top + rect.height / 2));
    var pointed = document.elementFromPoint(x, y);
    return Boolean(pointed && (
      pointed === element
      || element.contains(pointed)
      || pointed.contains(element)
    ));
  }

  function candidates() {
    var selector = [
      'a[href]',
      'button',
      'input:not([type="hidden"])',
      'select',
      'textarea',
      'summary',
      'video[controls]',
      '[role="button"]',
      '[role="link"]',
      '[role="menuitem"]',
      '[role="option"]',
      '[role="tab"]',
      '[tabindex]',
      '[onclick]',
      '[style*="cursor"]',
      '[class*="cursor-pointer"]',
      '[class*="clickable"]',
      'img'
    ].join(',');
    var found = Array.prototype.slice.call(document.querySelectorAll(selector));
    Array.prototype.forEach.call(document.querySelectorAll('*'), function (element) {
      if (hasClickHandler(element) && found.indexOf(element) === -1) found.push(element);
    });
    return found.filter(function (element) {
      if (!isVisible(element) || !isReachable(element)) return false;
      if (element.closest && element.closest('svg')) return false;
      if (element.tagName === 'IMG') {
        if (!hasClickHandler(element)) return false;
      }
      var tabindex = element.getAttribute('tabindex');
      return tabindex !== '-1'
        || element === activeElement
        || element.hasAttribute('data-rugare-tv-focusable')
        || hasClickHandler(element);
    });
  }

  function viewportIntersects(rect) {
    return rect.bottom > 0
      && rect.right > 0
      && rect.top < window.innerHeight
      && rect.left < window.innerWidth;
  }

  function setActive(element) {
    if (!element || !isVisible(element)) return false;
    if (activeElement && activeElement !== element) {
      stopSelectAdjustment();
      activeElement.classList.remove(FOCUS_CLASS);
    }
    activeElement = element;
    activeSignature = elementSignature(element);
    activePoint = elementCenter(element);
    activeElement.classList.add(FOCUS_CLASS);
    if (!activeElement.hasAttribute('tabindex')) {
      activeElement.setAttribute('tabindex', '-1');
      activeElement.setAttribute('data-rugare-tv-focusable', 'true');
    }
    try {
      activeElement.focus({ preventScroll: true });
    } catch (_error) {
      activeElement.focus();
    }
    activeElement.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
    return true;
  }

  function elementSignature(element) {
    if (!element) return '';
    var label = element.getAttribute('aria-label')
      || element.getAttribute('title')
      || element.textContent
      || '';
    var href = element.href || element.getAttribute('href') || '';
    return [
      element.tagName || '',
      element.getAttribute('role') || '',
      String(href),
      String(label).replace(/\s+/g, ' ').trim().slice(0, 180)
    ].join('|');
  }

  function restoreActive(items) {
    if (!activeSignature) return false;
    var matches = items.filter(function (element) {
      return elementSignature(element) === activeSignature;
    });
    if (!matches.length) return false;
    if (activePoint) {
      matches.sort(function (left, right) {
        var a = elementCenter(left);
        var b = elementCenter(right);
        var aDistance = Math.pow(a.x - activePoint.x, 2) + Math.pow(a.y - activePoint.y, 2);
        var bDistance = Math.pow(b.x - activePoint.x, 2) + Math.pow(b.y - activePoint.y, 2);
        return aDistance - bDistance;
      });
    }
    return setActive(matches[0]);
  }

  function elementCenter(element) {
    var rect = element.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      rect: rect
    };
  }

  function firstVisible(items, direction) {
    var visible = items.filter(function (element) {
      return viewportIntersects(element.getBoundingClientRect());
    });
    if (!visible.length) return null;
    visible.sort(function (left, right) {
      var a = elementCenter(left);
      var b = elementCenter(right);
      if (direction === 'up') return b.y - a.y || a.x - b.x;
      if (direction === 'left') return a.x - b.x || a.y - b.y;
      if (direction === 'right') return b.x - a.x || a.y - b.y;
      return a.y - b.y || a.x - b.x;
    });
    return visible[0];
  }

  function scoreCandidate(origin, candidate, direction) {
    var point = elementCenter(candidate);
    var dx = point.x - origin.x;
    var dy = point.y - origin.y;
    var primary;
    var secondary;
    var aligned;
    if (direction === 'up') {
      if (dy >= -2) return Number.POSITIVE_INFINITY;
      primary = -dy;
      secondary = Math.abs(dx);
      aligned = point.rect.right > origin.rect.left + 2
        && point.rect.left < origin.rect.right - 2;
    } else if (direction === 'down') {
      if (dy <= 2) return Number.POSITIVE_INFINITY;
      primary = dy;
      secondary = Math.abs(dx);
      aligned = point.rect.right > origin.rect.left + 2
        && point.rect.left < origin.rect.right - 2;
    } else if (direction === 'left') {
      if (dx >= -2) return Number.POSITIVE_INFINITY;
      primary = -dx;
      secondary = Math.abs(dy);
      aligned = point.rect.bottom > origin.rect.top + 2
        && point.rect.top < origin.rect.bottom - 2;
    } else {
      if (dx <= 2) return Number.POSITIVE_INFINITY;
      primary = dx;
      secondary = Math.abs(dy);
      aligned = point.rect.bottom > origin.rect.top + 2
        && point.rect.top < origin.rect.bottom - 2;
    }
    var alignmentPenalty = aligned
      ? 0
      : Math.max(600, window.innerWidth, window.innerHeight) * 2500;
    return alignmentPenalty + primary * 1000 + secondary * 3;
  }

  function clearActive() {
    stopSelectAdjustment();
    if (activeElement) activeElement.classList.remove(FOCUS_CLASS);
    activeElement = null;
    activeSignature = '';
    activePoint = null;
  }

  function scrollPage(direction) {
    var vertical = direction === 'up' ? -1 : direction === 'down' ? 1 : 0;
    var horizontal = direction === 'left' ? -1 : direction === 'right' ? 1 : 0;
    clearActive();
    window.scrollBy({
      top: vertical * Math.max(260, window.innerHeight * 0.7),
      left: horizontal * Math.max(260, window.innerWidth * 0.7),
      behavior: 'auto'
    });
    window.requestAnimationFrame(function () {
      setActive(firstVisible(candidates(), direction));
    });
    return true;
  }

  function stopSelectAdjustment() {
    if (selectAdjustmentElement) {
      selectAdjustmentElement.classList.remove('rugare-tv-select-adjusting');
    }
    selectAdjustmentElement = null;
  }

  function toggleSelectAdjustment(element) {
    if (!element || element.tagName !== 'SELECT') return false;
    if (selectAdjustmentElement === element) {
      stopSelectAdjustment();
      return true;
    }
    stopSelectAdjustment();
    selectAdjustmentElement = element;
    selectAdjustmentElement.classList.add('rugare-tv-select-adjusting');
    return true;
  }

  function adjustSelect(direction) {
    var select = selectAdjustmentElement;
    if (!select || !isVisible(select) || select.tagName !== 'SELECT') {
      stopSelectAdjustment();
      return false;
    }
    var step = direction === 'up' || direction === 'left' ? -1 : 1;
    var options = Array.prototype.slice.call(select.options || []);
    if (!options.length) return true;
    var currentIndex = Number(select.selectedIndex);
    if (currentIndex < 0 || currentIndex >= options.length) {
      currentIndex = step < 0 ? options.length : -1;
    }
    var nextIndex = currentIndex + step;
    while (nextIndex >= 0 && nextIndex < options.length && options[nextIndex].disabled) {
      nextIndex += step;
    }
    if (nextIndex < 0 || nextIndex >= options.length) return true;
    select.selectedIndex = nextIndex;
    select.value = options[nextIndex].value;
    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function move(direction) {
    if (selectAdjustmentElement) return adjustSelect(direction);
    var items = candidates();
    if (!items.length) return scrollPage(direction);
    if (!activeElement || !items.includes(activeElement) || !isVisible(activeElement)) {
      restoreActive(items);
      if (!activeElement || !items.includes(activeElement) || !isVisible(activeElement)) {
        return setActive(firstVisible(items, direction)) || scrollPage(direction);
      }
    }

    var origin = elementCenter(activeElement);
    var best = null;
    var bestScore = Number.POSITIVE_INFINITY;
    items.forEach(function (candidate) {
      if (candidate === activeElement) return;
      if (activeElement.contains(candidate) || candidate.contains(activeElement)) return;
      var score = scoreCandidate(origin, candidate, direction);
      if (score < bestScore) {
        best = candidate;
        bestScore = score;
      }
    });
    return setActive(best) || scrollPage(direction);
  }

  function largestMedia() {
    var media = Array.prototype.filter.call(document.querySelectorAll('video, iframe'), isVisible);
    media.sort(function (left, right) {
      var a = left.getBoundingClientRect();
      var b = right.getBoundingClientRect();
      return (b.width * b.height) - (a.width * a.height);
    });
    return media[0] || null;
  }

  function playPause() {
    var video = largestMedia();
    if (!video || video.tagName !== 'VIDEO') return false;
    if (video.paused) {
      video.play().catch(function () {});
    } else {
      video.pause();
    }
    return true;
  }

  function activate() {
    var element = activeElement && isVisible(activeElement) ? activeElement : document.activeElement;
    if (!element || element === document.body || element === document.documentElement) {
      element = largestMedia();
    }
    if (!element) return false;
    if (element.tagName === 'SELECT') return toggleSelectAdjustment(element);
    if (element.tagName === 'VIDEO') {
      if (sportyMode && element.requestFullscreen) {
        try {
          var request = element.requestFullscreen();
          if (request && request.catch) request.catch(function () {});
        } catch (_error) {}
      }
      return playPause();
    }
    try {
      element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'auto' });
      var rect = element.getBoundingClientRect();
      var pointedElement = document.elementFromPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2
      );
      var activationTarget = pointedElement && element.contains(pointedElement)
        ? pointedElement
        : element;
      activationTarget.click();
      return true;
    } catch (_error) {
      return false;
    }
  }

  function findPlayerShell(media) {
    if (!media) return null;
    var shell = media.closest(
      '[data-player], [class*="player"], [class*="video-container"], [class*="video_wrapper"], [id*="player"], [id*="video"]'
    );
    if (!shell || shell === document.body || shell === document.documentElement) {
      shell = media.parentElement || media;
    }
    return shell;
  }

  function preferHighQuality(shell) {
    if (!shell) return;
    var playerHost = shell.closest ? shell.closest('.video-js') : null;
    var player = playerHost && playerHost.player;
    if (player && typeof player.qualityLevels === 'function') {
      var qualityLevels = player.qualityLevels();
      if (qualityLevels && qualityLevels.length) {
        var bestQuality = null;
        for (var index = 0; index < qualityLevels.length; index += 1) {
          var quality = qualityLevels[index];
          if (!bestQuality
            || Number(quality.height || 0) > Number(bestQuality.height || 0)
            || (Number(quality.height || 0) === Number(bestQuality.height || 0)
              && Number(quality.bitrate || Number.MAX_SAFE_INTEGER)
                < Number(bestQuality.bitrate || Number.MAX_SAFE_INTEGER))) {
            bestQuality = quality;
          }
        }
        for (var qualityIndex = 0; qualityIndex < qualityLevels.length; qualityIndex += 1) {
          qualityLevels[qualityIndex].enabled = qualityLevels[qualityIndex] === bestQuality;
        }
        if (bestQuality) {
          var qualityKey = String(bestQuality.id || '')
            + ':' + String(bestQuality.height || bestQuality.width || '')
            + ':' + String(bestQuality.bitrate || '');
          var previousQualityKey = playerHost.getAttribute('data-rugare-quality-key');
          playerHost.setAttribute(
            'data-rugare-quality',
            String(bestQuality.height || bestQuality.width || 'high')
          );
          playerHost.setAttribute('data-rugare-quality-key', qualityKey);
          var playlistController = player.tech_
            && player.tech_.vhs
            && player.tech_.vhs.playlistController_;
          if (previousQualityKey !== qualityKey
            && playlistController
            && typeof playlistController.fastQualityChange_ === 'function') {
            try {
              playlistController.fastQualityChange_();
            } catch (_error) {}
          }
        }
        return;
      }
    }
    var options = Array.prototype.filter.call(shell.querySelectorAll('option'), function (option) {
      return /(?:2160|1440|1080|high|\bhd\b)/i.test(option.textContent || '');
    });
    if (!options.length) return;
    options.sort(function (left, right) {
      var a = Number((left.textContent.match(/\d+/) || [0])[0]);
      var b = Number((right.textContent.match(/\d+/) || [0])[0]);
      return b - a;
    });
    var option = options[0];
    var select = option.parentElement;
    if (!select || select.tagName !== 'SELECT') return;
    select.value = option.value;
    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function ensureUnmutedMedia() {
    if (!unmuteMode) return;
    Array.prototype.forEach.call(document.querySelectorAll('video, audio'), function (media) {
      media.removeAttribute('muted');
      media.defaultMuted = false;
      media.muted = false;
      media.volume = 1;
    });
  }

  function optimizeSportyPlayer() {
    if (!sportyMode) return;
    document.documentElement.classList.add('rugare-sporty-full');
    var media = largestMedia();
    if (!media) return;
    var shell = findPlayerShell(media);
    if (shell) shell.classList.add(PLAYER_CLASS);
    if (media.tagName === 'VIDEO') {
      media.autoplay = true;
      media.controls = true;
      media.preload = 'auto';
      media.playsInline = false;
      media.removeAttribute('playsinline');
      media.play().catch(function () {});
    }
    preferHighQuality(shell);
  }

  function refresh() {
    addStyles();
    if (selectAdjustmentElement && !isVisible(selectAdjustmentElement)) {
      stopSelectAdjustment();
    }
    if (activeElement && !isVisible(activeElement)) {
      if (!restoreActive(candidates())) activeElement = null;
    }
    ensureUnmutedMedia();
    optimizeSportyPlayer();
  }

  function configure(options) {
    sportyMode = Boolean(options && options.sporty);
    unmuteMode = Boolean(options && options.unmute);
    refresh();
    if (refreshTimer) window.clearInterval(refreshTimer);
    refreshTimer = window.setInterval(refresh, sportyMode || unmuteMode ? 1200 : 4000);
  }

  window.__rugareTvRemote = {
    version: CONTROLLER_VERSION,
    activate: activate,
    configure: configure,
    move: move,
    page: scrollPage,
    playPause: playPause,
    refresh: refresh
  };

  addStyles();
  new MutationObserver(function () {
    window.clearTimeout(window.__rugareTvRemoteMutationTimer);
    window.__rugareTvRemoteMutationTimer = window.setTimeout(refresh, 180);
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
