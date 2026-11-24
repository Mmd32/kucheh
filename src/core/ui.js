const SVG_NS = 'http://www.w3.org/2000/svg';

function applyProps(el, props) {
  if (!props) return;
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;

    switch (key) {
      case 'class':
      case 'className':
        el.className = value;
        break;
      case 'text':
        el.textContent = value;
        break;
      case 'html':
        el.innerHTML = value;
        break;
      case 'dataset':
        Object.assign(el.dataset, value);
        break;
      case 'style':
        if (typeof value === 'string') {
          el.style.cssText = value;
        } else {
          for (const [prop, val] of Object.entries(value)) {
            if (val == null) continue;
            if (prop.startsWith('--')) el.style.setProperty(prop, String(val));
            else el.style[prop] = val;
          }
        }
        break;
      case 'value':
        el.value = value;
        break;
      case 'checked':
      case 'disabled':
      case 'selected':
      case 'hidden':
      case 'readOnly':
      case 'multiple':
        el[key] = Boolean(value);
        break;
      default:
        if (key.startsWith('on') && typeof value === 'function') {
          el.addEventListener(key.slice(2).toLowerCase(), value);
        } else {
          el.setAttribute(key, value === true ? '' : value);
        }
    }
  }
}

function appendChildren(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false || child === true) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  applyProps(el, props);
  appendChildren(el, children);
  return el;
}

export function s(tag, props, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value == null || value === false) continue;
      if (key === 'text') {
        el.textContent = value;
        continue;
      }
      if (key === 'class') {
        el.setAttribute('class', value);
        continue;
      }
      if (key.startsWith('on') && typeof value === 'function') {
        el.addEventListener(key.slice(2).toLowerCase(), value);
        continue;
      }
      el.setAttribute(key, value === true ? '' : value);
    }
  }
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

export function clear(el) {
  el.replaceChildren();
  return el;
}

export function btn(label, { variant = 'ghost', className = '', ...rest } = {}) {
  return h('button', { type: 'button', class: `btn btn-${variant} ${className}`.trim(), ...rest }, label);
}

export function segmented(items, { value, onChange, label = 'انتخاب' } = {}) {
  const buttons = [];
  const setActive = (next) => {
    for (const b of buttons) {
      const on = b.dataset.value === String(next);
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', String(on));
    }
  };
  const wrap = h('div', { class: 'segmented', role: 'group', 'aria-label': label });
  for (const item of items) {
    const b = h('button', {
      type: 'button',
      class: 'seg-btn',
      'data-value': String(item.value),
      text: item.label,
      onClick: () => {
        setActive(item.value);
        if (onChange) onChange(item.value);
      },
    });
    buttons.push(b);
    wrap.append(b);
  }
  setActive(value);
  return wrap;
}

export function field(label, control) {
  return h('label', { class: 'field' }, h('span', { class: 'field-label', text: label }), control);
}

export function fieldInline(label, control) {
  return h('div', { class: 'field-inline' }, h('span', { class: 'field-label', text: label }), control);
}

export function panel(children, { className = '' } = {}) {
  return h('div', { class: `panel ${className}`.trim() }, children);
}

/* ---------- modal ---------- */

let modalCount = 0;

export function openModal({ title = '', body = null, actions = [], dismissible = true, className = '' } = {}) {
  const root = document.getElementById('modal-root');
  const prevFocus = document.activeElement;
  modalCount += 1;
  document.body.style.overflow = 'hidden';

  function close() {
    document.removeEventListener('keydown', onKey);
    backdrop.remove();
    modalCount = Math.max(0, modalCount - 1);
    if (modalCount === 0) document.body.style.overflow = '';
    if (prevFocus && typeof prevFocus.focus === 'function') {
      try {
        prevFocus.focus();
      } catch (err) {
        /* ignore */
      }
    }
  }

  function focusables() {
    return [...dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(
      (el) => !el.disabled && !el.hidden && el.getAttribute('aria-hidden') !== 'true',
    );
  }

  function onKey(e) {
    if (e.key === 'Escape' && dismissible) {
      close();
      return;
    }
    if (e.key !== 'Tab') return;
    const items = focusables();
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !dialog.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !dialog.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  }

  const dialog = h(
    'div',
    {
      class: `modal ${className}`.trim(),
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': title || 'گفت‌وگو',
    },
    h(
      'div',
      { class: 'modal-head' },
      h('h2', { class: 'modal-title', text: title }),
      dismissible
        ? h(
            'button',
            { class: 'icon-btn modal-close', type: 'button', 'aria-label': 'بستن', onClick: close },
            h('span', { html: CLOSE_ICON }),
          )
        : null,
    ),
    h('div', { class: 'modal-body' }, body),
    actions.length
      ? h(
          'div',
          { class: 'modal-actions' },
          actions.map((action) =>
            btn(action.label, {
              variant: action.variant || 'ghost',
              onClick: () => {
                if (action.keepOpen !== true) close();
                if (action.onClick) action.onClick();
              },
            }),
          ),
        )
      : null,
  );

  const backdrop = h(
    'div',
    {
      class: 'modal-backdrop',
      onClick: (e) => {
        if (e.target === backdrop && dismissible) close();
      },
    },
    dialog,
  );

  root.append(backdrop);
  requestAnimationFrame(() => backdrop.classList.add('is-open'));
  document.addEventListener('keydown', onKey);

  const focusable = dialog.querySelector('button, input, select, textarea, [tabindex]');
  if (focusable) focusable.focus({ preventScroll: true });

  return { el: dialog, close };
}

export function closeAllModals() {
  const root = document.getElementById('modal-root');
  if (root) root.replaceChildren();
  modalCount = 0;
  if (typeof document !== 'undefined' && document.body) document.body.style.overflow = '';
}

const CLOSE_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

export function confirmDialog({ title = 'مطمئنی؟', text = '', confirmLabel = 'بله', onConfirm }) {
  return openModal({
    title,
    body: h('p', { text }),
    actions: [
      { label: confirmLabel, variant: 'danger', onClick: onConfirm },
      { label: 'انصراف', variant: 'ghost' },
    ],
  });
}

/* ---------- toast ---------- */

export function toast(message, { duration = 2200 } = {}) {
  const root = document.getElementById('toast-root');
  const el = h('div', { class: 'toast', role: 'status', text: message });
  root.append(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity .2s ease';
    setTimeout(() => el.remove(), 220);
  }, duration);
  return el;
}

/* ---------- misc ---------- */

export function timerBar(seconds) {
  return h('div', { class: 'timer-line' }, h('div', { class: 'timer-fill', style: { width: '100%' } }));
}

export function prettyTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return `${m}:${String(rest).padStart(2, '0')}`;
}
