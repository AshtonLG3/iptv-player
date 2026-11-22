export function createOverlayIdle({
  isActive, canDismiss = () => true, onDismiss, delayMs = 10000,
  timers = { set: (callback, delay) => setTimeout(callback, delay), clear: (id) => clearTimeout(id) },
}) {
  let timer = null;
  let generation = 0;
  let disposed = false;

  function activity() {
    const token = ++generation;
    if (timer !== null) timers.clear(timer);
    timer = null;
    if (disposed || !isActive()) return;
    timer = timers.set(() => {
      if (disposed || token !== generation) return;
      timer = null;
      if (!isActive()) return;
      if (!canDismiss()) { activity(); return; }
      onDismiss();
    }, delayMs);
  }

  function dispose() {
    disposed = true;
    activity();
  }

  return { activity, dispose };
}
