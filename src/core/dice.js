import { h } from './ui.js';

const PIPS = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export function die(value, { className = '', label = null } = {}) {
  const on = PIPS[value] || [];
  const cells = [];
  for (let i = 0; i < 9; i++) {
    cells.push(h('span', { class: on.includes(i) ? 'pip' : 'pip pip-off' }));
  }
  return h(
    'div',
    {
      class: `die ${className}`.trim(),
      role: 'img',
      'aria-label': label || `تاس ${value}`,
    },
    cells,
  );
}
