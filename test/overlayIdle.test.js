import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOverlayIdle } from '../src/overlayIdle.js';

function fixture() {
  let now = 0, id = 0, dismissed = 0, active = true, editable = false;
  const queue = new Map();
  const controller = createOverlayIdle({
    isActive: () => active, canDismiss: () => !editable, onDismiss: () => { dismissed++; active = false; },
    timers: { set: (callback, delay) => { queue.set(++id, { callback, due: now + delay }); return id; }, clear: key => queue.delete(key) },
  });
  return { controller, queue, get dismissed() { return dismissed; },
    set active(value) { active = value; }, set editable(value) { editable = value; },
    advance(ms) {
      const end = now + ms;
      while (true) {
        const next = [...queue.entries()].filter(([, job]) => job.due <= end).sort((a, b) => a[1].due - b[1].due)[0];
        if (!next) break;
        now = next[1].due; queue.delete(next[0]); next[1].callback();
      }
      now = end;
    },
  };
}

test('idle overlays dismiss after ten seconds, and remote activity restarts the deadline', () => {
  const f = fixture(); f.controller.activity(); f.advance(9000);
  assert.equal(f.dismissed, 0);
  f.controller.activity(); f.advance(9999); assert.equal(f.dismissed, 0);
  f.advance(1); assert.equal(f.dismissed, 1);
  f.advance(30000); assert.equal(f.dismissed, 1);
  f.active = true; f.controller.activity(); f.advance(10000); assert.equal(f.dismissed, 2);
});

test('closing a panel, active composition and page cleanup prevent stale dismissals', () => {
  const f = fixture(); f.controller.activity(); const stale = [...f.queue.values()][0].callback;
  f.active = false; f.controller.activity(); stale(); assert.equal(f.dismissed, 0);
  f.active = true; f.editable = true; f.controller.activity(); f.advance(20000); assert.equal(f.dismissed, 0);
  f.editable = false; f.controller.activity(); f.advance(10000); assert.equal(f.dismissed, 1);
  f.active = true; f.controller.activity(); f.controller.dispose(); f.controller.activity();
  f.advance(20000); assert.equal(f.dismissed, 1); assert.equal(f.queue.size, 0);
});

test('repeated text-input activity extends an edit, but idle focus alone does not', () => {
  const f = fixture(); f.controller.activity();
  for (let index = 0; index < 3; index++) {
    f.advance(9000); f.controller.activity(); assert.equal(f.dismissed, 0);
  }
  f.advance(10000); assert.equal(f.dismissed, 1);
});
