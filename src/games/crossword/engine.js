// جدول کلمات متقاطع: ساخت شبکه از فهرست پاسخ‌ها و سرنخ‌ها.

export function buildPuzzle(data) {
  const grid = Array.from({ length: data.rows }, () => Array(data.cols).fill(null));
  const entries = data.entries.map((entry, index) => {
    const cells = [];
    for (let i = 0; i < entry.answer.length; i++) {
      const r = entry.dir === 'across' ? entry.row : entry.row + i;
      const c = entry.dir === 'across' ? entry.col + i : entry.col;
      if (r < 0 || r >= data.rows || c < 0 || c >= data.cols) {
        throw new Error(`خانه خارج از شبکه: ${data.id} — ${entry.answer}`);
      }
      if (grid[r][c] && grid[r][c] !== entry.answer[i]) {
        throw new Error(`تضاد حروف در ${data.id}: ${entry.answer}`);
      }
      grid[r][c] = entry.answer[i];
      cells.push({ r, c, key: r * data.cols + c });
    }
    return { ...entry, cells, index };
  });

  let next = 1;
  const numbers = new Map();
  for (let r = 0; r < data.rows; r++) {
    for (let c = 0; c < data.cols; c++) {
      if (!grid[r][c]) continue;
      const starts = entries.some((e) => e.row === r && e.col === c);
      if (starts) {
        numbers.set(`${r},${c}`, next);
        next += 1;
      }
    }
  }

  for (const entry of entries) {
    entry.number = numbers.get(`${entry.row},${entry.col}`) || 0;
  }

  return { ...data, grid, entries, numbers };
}

// بررسی سلامت داده: هر ردیف/ستونِ پُر باید دقیقاً یک مدخل داشته باشد.
export function validatePuzzle(data) {
  const built = buildPuzzle(data);
  const errors = [];
  const { grid, entries } = built;

  const covered = (r, c, dir) =>
    entries.some((e) => e.dir === dir && e.cells.some((cell) => cell.r === r && cell.c === c));

  const runs = [];
  for (let r = 0; r < data.rows; r++) {
    let start = -1;
    for (let c = 0; c <= data.cols; c++) {
      const filled = c < data.cols && Boolean(grid[r][c]);
      if (filled && start === -1) start = c;
      if (!filled && start !== -1) {
        if (c - start >= 2) runs.push({ dir: 'across', r, c: start, len: c - start });
        start = -1;
      }
    }
  }
  for (let c = 0; c < data.cols; c++) {
    let start = -1;
    for (let r = 0; r <= data.rows; r++) {
      const filled = r < data.rows && Boolean(grid[r][c]);
      if (filled && start === -1) start = r;
      if (!filled && start !== -1) {
        if (r - start >= 2) runs.push({ dir: 'down', r: start, c, len: r - start });
        start = -1;
      }
    }
  }

  for (const run of runs) {
    const match = entries.some(
      (e) => e.dir === run.dir && e.row === run.r && e.col === run.c && e.answer.length === run.len,
    );
    if (!match) errors.push(`ردیف ناخواسته: ${JSON.stringify(run)}`);
  }

  for (const entry of entries) {
    for (let i = 0; i < entry.cells.length; i++) {
      const { r, c } = entry.cells[i];
      if (grid[r][c] !== entry.answer[i]) errors.push(`حرف نادرست در ${entry.answer} خانه‌ی ${r},${c}`);
    }
  }

  return errors;
}

export function cellEntries(entryList, r, c) {
  return entryList.filter((e) => e.cells.some((cell) => cell.r === r && cell.c === c));
}
