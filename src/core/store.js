// ذخیره‌سازی محلی: تنظیمات، آمار و بازی‌های نیمه‌تمام.

const PREFIX = 'bazikhaneh.v1.';
const SETTINGS_KEY = 'settings';
const STATS_KEY = 'stats';
const SAVES_KEY = 'saves';
const SCHEMA_VERSION = 2;

export const DEFAULT_SETTINGS = {
  numerals: 'fa',
  sound: true,
  theme: 'light',
  motion: 'full',
  boardScale: 1,
  playerName: '',
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw == null) return fallback;
    const value = JSON.parse(raw);
    return value == null ? fallback : value;
  } catch (err) {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch (err) {
    /* حافظه پر است یا در دسترس نیست؛ بازی باید بی‌صدا ادامه پیدا کند. */
  }
}

// اعتبارسنجی سبک برای داده‌ای که از بیرون می‌آید (localStorage دست‌کاری‌شده یا نسخه‌ی قدیمی).
export function sanitizeSave(gameId, data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
  const isInt8 = (v) => Number.isInteger(v) && v >= 0 && v <= 8;
  const allInts = (list, pred) => Array.isArray(list) && list.every(pred);

  switch (gameId) {
    case 'backgammon': {
      const st = data.state;
      if (!st || !Array.isArray(st.points) || st.points.length !== 24) return null;
      for (const point of st.points) {
        if (point == null) continue;
        if (!point || (point.color !== 'w' && point.color !== 'b') || !isNum(point.n) || point.n < 1 || point.n > 15) return null;
      }
      if (!st.bar || !isNum(st.bar.w) || !isNum(st.bar.b) || !st.off || !isNum(st.off.w) || !isNum(st.off.b)) return null;
      if (st.turn !== 'w' && st.turn !== 'b') return null;
      return data;
    }
    case 'dots': {
      if (!Array.isArray(data.h) || data.h.length !== 6) return null;
      if (!Array.isArray(data.v) || data.v.length !== 5) return null;
      if (!allInts(data.boxes, (v) => isInt8(v)) || data.boxes.length !== 25) return null;
      if (!Array.isArray(data.scores) || data.scores.length !== 2 || !data.scores.every(isNum)) return null;
      if (data.turn !== 0 && data.turn !== 1) return null;
      if (!isNum(data.moves) || data.moves < 0 || data.moves > 60) return null;
      return data;
    }
    case 'chess': {
      if (typeof data.fen !== 'string' || !/^[rnbqkpRNBQKP1-8/]+ [wb] /.test(data.fen)) return null;
      if (data.mode !== 'ai' && data.mode !== 'local') return null;
      if (!['easy', 'medium', 'hard'].includes(data.level)) return null;
      if (data.sans && !(Array.isArray(data.sans) && data.sans.every((item) => typeof item === 'string'))) return null;
      if (data.keys && !(Array.isArray(data.keys) && data.keys.every((item) => typeof item === 'string'))) return null;
      return data;
    }
    case 'sudoku': {
      const nine = (list) => Array.isArray(list) && list.length === 81 && list.every((v) => Number.isInteger(v) && v >= 0 && v <= 9);
      if (!nine(data.puzzle) || !nine(data.solution) || !nine(data.entries)) return null;
      if (!Array.isArray(data.notes) || data.notes.length !== 81) return null;
      if (!data.notes.every((list) => Array.isArray(list) && list.every((v) => Number.isInteger(v) && v >= 1 && v <= 9))) return null;
      if (!['easy', 'medium', 'hard'].includes(data.difficulty)) return null;
      if (!isNum(data.seconds) || data.seconds < 0 || data.seconds > 60 * 60 * 24) return null;
      if (!isNum(data.hints) || data.hints < 0 || data.hints > 3) return null;
      return data;
    }
    case 'crossword': {
      if (typeof data.id !== 'string') return null;
      if (!Array.isArray(data.values) || !data.values.every((v) => typeof v === 'string' && v.length <= 1)) return null;
      return data;
    }
    case 'battleship': {
      const board = (b) => {
        if (!b || !Array.isArray(b.ships) || !Array.isArray(b.shots) || b.shots.length !== 100) return false;
        if (!b.ships.every((ship) => Array.isArray(ship.cells) && Array.isArray(ship.hits) && isNum(ship.size))) return false;
        return b.shots.every((shot) => shot === null || shot === 'hit' || shot === 'miss');
      };
      if (data.phase !== 'play' || !board(data.my) || !board(data.enemy)) return null;
      return data;
    }
    default:
      return data;
  }
}

export function getSettings() {
  return { ...DEFAULT_SETTINGS, ...read(SETTINGS_KEY, {}) };
}

export function applySettings() {
  const { numerals, theme, motion, boardScale } = getSettings();
  const root = document.documentElement;
  root.dataset.numerals = numerals;
  root.dataset.theme = theme === 'dark' ? 'dark' : 'light';
  root.dataset.motion = motion === 'reduced' ? 'reduced' : 'full';
  root.style.setProperty('--board-scale', String([0.85, 1, 1.15].includes(boardScale) ? boardScale : 1));
}

export function setSetting(key, value) {
  const next = { ...getSettings(), [key]: value };
  write(SETTINGS_KEY, next);
  applySettings();
  window.dispatchEvent(new CustomEvent('settings:change', { detail: next }));
  return next;
}

export function getStats() {
  return read(STATS_KEY, {});
}

const EMPTY_STAT = { plays: 0, wins: 0, losses: 0, draws: 0, best: 0 };

export function getStat(gameId) {
  return { ...EMPTY_STAT, ...(getStats()[gameId] || {}) };
}

// result: 'win' | 'loss' | 'draw' | عدد (برای رکورد)
export function recordStat(gameId, result) {
  const stats = getStats();
  const entry = { ...EMPTY_STAT, ...(stats[gameId] || {}) };
  if (result === 'win') {
    entry.wins += 1;
    entry.plays += 1;
  } else if (result === 'loss') {
    entry.losses += 1;
    entry.plays += 1;
  } else if (result === 'draw') {
    entry.draws += 1;
    entry.plays += 1;
  } else if (typeof result === 'number' && Number.isFinite(result)) {
    if (result > entry.best) entry.best = result;
  }
  stats[gameId] = entry;
  write(STATS_KEY, stats);
  return entry;
}

export function clearStats() {
  write(STATS_KEY, {});
}

export function saveGame(gameId, data) {
  const saves = read(SAVES_KEY, {});
  saves[gameId] = { ts: Date.now(), v: SCHEMA_VERSION, data };
  write(SAVES_KEY, saves);
}

export function loadGame(gameId) {
  const saves = read(SAVES_KEY, {});
  const entry = saves[gameId];
  if (!entry || !entry.data) return null;
  if (entry.v !== SCHEMA_VERSION) {
    delete saves[gameId];
    write(SAVES_KEY, saves);
    return null;
  }
  const clean = sanitizeSave(gameId, entry.data);
  if (!clean) {
    delete saves[gameId];
    write(SAVES_KEY, saves);
    return null;
  }
  return clean;
}

export function clearAllSaves() {
  write(SAVES_KEY, {});
}

export function exportData() {
  return JSON.stringify({
    app: 'kucheh',
    schema: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    settings: getSettings(),
    stats: getStats(),
    saves: listSaves(),
  }, null, 2);
}

export function importData(raw) {
  let parsed;
  try {
    parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (err) {
    return { ok: false, reason: 'فایل پشتیبان خوانده نشد؛ JSON معتبر نیست.' };
  }
  if (!parsed || parsed.app !== 'kucheh' || typeof parsed !== 'object') {
    return { ok: false, reason: 'این فایل پشتیبان کوچه نیست.' };
  }
  if (parsed.schema !== SCHEMA_VERSION) {
    return { ok: false, reason: 'نسخه‌ی فایل پشتیبان با این نسخه‌ی بازی نمی‌خواند.' };
  }
  const settings = { ...DEFAULT_SETTINGS, ...(parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : {}) };
  if (!['fa', 'en'].includes(settings.numerals)) settings.numerals = DEFAULT_SETTINGS.numerals;
  if (!['light', 'dark'].includes(settings.theme)) settings.theme = DEFAULT_SETTINGS.theme;
  if (!['full', 'reduced'].includes(settings.motion)) settings.motion = DEFAULT_SETTINGS.motion;
  settings.sound = Boolean(settings.sound);
  settings.boardScale = [0.85, 1, 1.15].includes(settings.boardScale) ? settings.boardScale : 1;
  settings.playerName = typeof settings.playerName === 'string' ? settings.playerName.slice(0, 20) : '';

  const stats = {};
  if (parsed.stats && typeof parsed.stats === 'object') {
    for (const [id, entry] of Object.entries(parsed.stats)) {
      if (!/^[a-z]+$/.test(id) || !entry || typeof entry !== 'object') continue;
      const safe = { ...EMPTY_STAT };
      for (const key of ['plays', 'wins', 'losses', 'draws', 'best']) {
        const value = Number(entry[key]);
        safe[key] = Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
      }
      stats[id] = safe;
    }
  }

  const saves = {};
  if (parsed.saves && typeof parsed.saves === 'object') {
    for (const [id, entry] of Object.entries(parsed.saves)) {
      if (!/^[a-z]+$/.test(id) || !entry || typeof entry !== 'object') continue;
      const clean = sanitizeSave(id, entry.data);
      if (clean) saves[id] = { ts: Date.now(), v: SCHEMA_VERSION, data: clean };
    }
  }

  write(SETTINGS_KEY, settings);
  write(STATS_KEY, stats);
  write(SAVES_KEY, saves);
  applySettings();
  window.dispatchEvent(new CustomEvent('settings:change', { detail: settings }));
  return { ok: true, reason: '' };
}

export function clearSavedGame(gameId) {
  const saves = read(SAVES_KEY, {});
  if (saves[gameId]) {
    delete saves[gameId];
    write(SAVES_KEY, saves);
  }
}

export function listSaves() {
  return read(SAVES_KEY, {});
}
