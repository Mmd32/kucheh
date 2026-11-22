// تایمر شمارش معکوس برای بازی‌های تیمی.

export function createCountdown({ duration, onTick, onDone, interval = 100 }) {
  let endAt = 0;
  let handle = null;
  let running = false;
  let remaining = duration;

  function stop() {
    running = false;
    if (handle) clearInterval(handle);
    handle = null;
  }

  function tick() {
    const left = Math.max(0, endAt - Date.now());
    remaining = left / 1000;
    if (onTick) onTick(remaining, duration);
    if (left <= 0) {
      stop();
      if (onDone) onDone();
    }
  }

  function start() {
    if (running) return;
    running = true;
    endAt = Date.now() + remaining * 1000;
    handle = setInterval(tick, interval);
    tick();
  }

  function pause() {
    if (!running) return;
    const left = Math.max(0, endAt - Date.now());
    remaining = left / 1000;
    stop();
    if (onTick) onTick(remaining, duration);
  }

  function reset(seconds) {
    stop();
    remaining = seconds;
    if (onTick) onTick(remaining, seconds);
  }

  return {
    start,
    stop,
    pause,
    reset,
    get remaining() {
      return remaining;
    },
  };
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
