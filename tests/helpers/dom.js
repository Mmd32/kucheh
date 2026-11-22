// یک DOM کوچک و ساختگی برای اینکه بتوانیم همه‌ی بازی‌ها را بدون مرورگر mount کنیم.

class NodeBase {
  constructor() {
    this.parentElement = null;
    this.childNodes = [];
    this.nodeType = 0;
  }

  get children() {
    return this.childNodes.filter((node) => node.nodeType === 1);
  }

  get firstChild() {
    return this.childNodes[0] || null;
  }

  append(...nodes) {
    for (const node of nodes.flat()) {
      if (node == null) continue;
      const child = typeof node === 'string' ? new TextNode(node) : node;
      child.parentElement = this;
      this.childNodes.push(child);
    }
  }

  appendChild(node) {
    this.append(node);
    return node;
  }

  prepend(...nodes) {
    const list = nodes.flat().filter(Boolean);
    for (const node of list) node.parentElement = this;
    this.childNodes.unshift(...list);
  }

  replaceChildren(...nodes) {
    for (const child of this.childNodes) child.parentElement = null;
    this.childNodes = [];
    this.append(...nodes);
  }

  remove() {
    const parent = this.parentElement;
    if (!parent) return;
    parent.childNodes = parent.childNodes.filter((node) => node !== this);
    this.parentElement = null;
  }

  get textContent() {
    return this.childNodes.map((node) => node.textContent).join('');
  }

  set textContent(value) {
    for (const child of this.childNodes) child.parentElement = null;
    this.childNodes = [];
    if (value !== '' && value != null) this.append(new TextNode(value));
  }

  get innerHTML() {
    return this._html || '';
  }

  set innerHTML(value) {
    this._html = String(value);
    for (const child of this.childNodes) child.parentElement = null;
    this.childNodes = [];
  }

  addEventListener(type, fn) {
    this._events = this._events || {};
    (this._events[type] = this._events[type] || []).push(fn);
  }

  removeEventListener(type, fn) {
    if (!this._events || !this._events[type]) return;
    this._events[type] = this._events[type].filter((cb) => cb !== fn);
  }

  dispatchEvent(event) {
    const list = (this._events && this._events[event.type]) || [];
    for (const fn of list) fn(event);
    return true;
  }

  focus() {
    document.activeElement = this;
  }

  blur() {
    if (document.activeElement === this) document.activeElement = null;
  }
}

class TextNode extends NodeBase {
  constructor(text) {
    super();
    this.nodeType = 3;
    this._text = String(text);
  }

  get textContent() {
    return this._text;
  }

  set textContent(value) {
    this._text = String(value);
  }

  get data() {
    return this._text;
  }
}

function camel(name) {
  return name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function matches(el, rawSelector) {
  const selector = rawSelector.trim();
  if (!selector) return false;
  if (selector.startsWith('.')) return el.classList.contains(selector.slice(1));
  if (selector.startsWith('#')) return el.attributes.get('id') === selector.slice(1);
  if (selector.startsWith('[')) {
    const inner = selector.slice(1, -1);
    const name = inner.split('=')[0].trim();
    if (el.attributes.has(name)) return true;
    return name === 'tabindex';
  }
  return el.tagName === selector.toUpperCase();
}

class Element extends NodeBase {
  constructor(tag, namespace = null) {
    super();
    this.nodeType = 1;
    this.localName = String(tag).toLowerCase();
    this.tagName = String(tag).toUpperCase();
    this.namespaceURI = namespace;
    this.attributes = new Map();
    this.dataset = {};
    this._class = '';
    this.hidden = false;
    this.disabled = false;
    this.checked = false;
    this.value = '';
    this.scrollTop = 0;
    this.scrollHeight = 0;
    this.style = {
      setProperty(name, value) {
        this[name] = value;
      },
      cssText: '',
    };
    this.classList = makeClassList(this);
  }

  get className() {
    return this._class;
  }

  set className(value) {
    this._class = String(value == null ? '' : value);
  }

  setAttribute(name, value) {
    const key = String(name);
    if (key === 'class') this._class = String(value);
    else if (key === 'id') this.attributes.set('id', String(value));
    else if (key.startsWith('data-')) this.dataset[camel(key.slice(5))] = String(value);
    else if (key === 'value') this.value = String(value);
    else this.attributes.set(key, String(value));
  }

  getAttribute(name) {
    const key = String(name);
    if (key === 'class') return this._class;
    return this.attributes.has(key) ? this.attributes.get(key) : null;
  }

  removeAttribute(name) {
    this.attributes.delete(String(name));
  }

  hasAttribute(name) {
    return this.attributes.has(String(name));
  }

  querySelectorAll(selector) {
    const parts = String(selector)
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    const out = [];
    const walk = (el) => {
      for (const child of el.children) {
        if (parts.some((part) => matches(child, part))) out.push(child);
        walk(child);
      }
    };
    walk(this);
    return out;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  getBoundingClientRect() {
    return { top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 };
  }

  getContext() {
    if (!this._ctx) {
      const noop = () => {};
      this._ctx = {
        beginPath: noop,
        arc: noop,
        fill: noop,
        stroke: noop,
        clearRect: noop,
        fillRect: noop,
        setTransform: noop,
        setLineDash: noop,
        moveTo: noop,
        lineTo: noop,
        closePath: noop,
        save: noop,
        restore: noop,
        translate: noop,
        rotate: noop,
        ellipse: noop,
        strokeRect: noop,
        createLinearGradient: () => ({ addColorStop: noop }),
        createRadialGradient: () => ({ addColorStop: noop }),
        measureText: () => ({ width: 0 }),
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
      };
    }
    return this._ctx;
  }
}

function makeClassList(el) {
  const list = () => el._class.split(/\s+/).filter(Boolean);
  const write = (names) => {
    el._class = [...new Set(names)].join(' ');
  };
  return {
    add: (...names) => write([...list(), ...names]),
    remove: (...names) => write(list().filter((name) => !names.includes(name))),
    contains: (name) => list().includes(name),
    toggle: (name, force) => {
      const has = list().includes(name);
      const on = force === undefined ? !has : Boolean(force);
      if (on) write([...list(), name]);
      else write(list().filter((item) => item !== name));
      return on;
    },
  };
}

export function installDom() {
  const documentElement = new Element('html');
  const body = new Element('body');
  const registry = new Map();

  const document = {
    documentElement,
    body,
    activeElement: null,
    createElement: (tag) => new Element(tag),
    createElementNS: (ns, tag) => new Element(tag, ns),
    createTextNode: (text) => new TextNode(text),
    getElementById(id) {
      if (!registry.has(id)) {
        const el = new Element('div');
        el.setAttribute('id', id);
        body.append(el);
        registry.set(id, el);
      }
      return registry.get(id);
    },
    querySelector(selector) {
      return body.querySelector(selector);
    },
    querySelectorAll(selector) {
      return body.querySelectorAll(selector);
    },
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return true;
    },
  };

  const storage = new Map();
  const localStorage = {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
    clear: () => storage.clear(),
  };

  class CustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
    }
  }

  globalThis.Node = NodeBase;
  globalThis.Element = Element;
  globalThis.HTMLElement = Element;
  globalThis.Text = TextNode;
  globalThis.document = document;
  globalThis.localStorage = localStorage;
  globalThis.CustomEvent = CustomEvent;
  globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  globalThis.scrollTo = () => {};
  globalThis.location = { hash: '' };
  if (typeof globalThis.window === 'undefined') {
    globalThis.window = globalThis;
  }
  globalThis.window.location = globalThis.location;
  globalThis.window.scrollTo = globalThis.scrollTo;
  globalThis.window.addEventListener = () => {};
  globalThis.window.removeEventListener = () => {};
  globalThis.window.dispatchEvent = () => true;
  globalThis.window.devicePixelRatio = 1;

  return { document, body, documentElement, localStorage, registry, Element, TextNode };
}
