import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFullscreenController } from '../src/fullscreen.js';

test('fullscreen controller enters and exits standard fullscreen', async () => {
  const documentObj = { fullscreenElement: null };
  const playerElement = {
    requestFullscreen() {
      documentObj.fullscreenElement = playerElement;
    },
  };
  documentObj.exitFullscreen = () => {
    documentObj.fullscreenElement = null;
  };
  const controller = createFullscreenController({
    documentObj,
    playerElement,
    videoElement: {},
  });

  assert.equal(controller.isSupported(), true);
  await controller.toggle();
  assert.equal(controller.isActive(), true);
  await controller.toggle();
  assert.equal(controller.isActive(), false);
});

test('fullscreen controller falls back to iOS video fullscreen', async () => {
  const videoElement = {
    webkitDisplayingFullscreen: false,
    webkitEnterFullscreen() {
      videoElement.webkitDisplayingFullscreen = true;
    },
    webkitExitFullscreen() {
      videoElement.webkitDisplayingFullscreen = false;
    },
  };
  const controller = createFullscreenController({
    documentObj: {},
    playerElement: {},
    videoElement,
  });

  assert.equal(controller.isSupported(), true);
  await controller.toggle();
  assert.equal(controller.isActive(), true);
  await controller.toggle();
  assert.equal(controller.isActive(), false);
});
