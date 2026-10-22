// The wireframe layouts' shared kit (docs/specs/007-editor/wireframe-pages.md "Wireframe
// layouts"): the parts a screen is wireframed from, at the sizes a real interface draws them
// (a 44 px button, a 15 px body line), placed in a page's safe area. Every part is an ordinary
// element in wireframe greys, a dark primary and soft grey pictures and fields, so a screen reads as
// a wireframe in any theme and every word stays editable.
import type { Element, ShapeElement, TextElement } from '@livepages/document';
import { kit, type Kit, type LayoutBox } from './page-layout-kit';

// The wireframe greys.
export const WF = {
  ink: '#0f172a',
  body: '#334155',
  muted: '#64748b',
  line: '#cbd5e1',
  soft: '#f1f5f9',
  place: '#e2e8f0',
  white: '#ffffff',
} as const;

// What a screen is laid out for: a phone's single column, a tablet's or computer's wider room,
// or a watch's face. Chosen from the safe area's width.
export type ScreenForm = 'watch' | 'phone' | 'wide';

const WATCH_MAX_WIDTH = 300;
const PHONE_MAX_WIDTH = 600;

export function screenForm(box: LayoutBox): ScreenForm {
  if (box.width < WATCH_MAX_WIDTH) return 'watch';
  if (box.width < PHONE_MAX_WIDTH) return 'phone';
  return 'wide';
}

type TextOpts = {
  size?: number;
  bold?: boolean;
  color?: string;
  align?: 'left' | 'center' | 'right';
  alignY?: 'top' | 'middle' | 'bottom';
};

export type Ui = {
  k: Kit;
  // The safe area's sides.
  W: number;
  H: number;
  form: ScreenForm;
  els: Element[];
  text: (x: number, y: number, w: number, h: number, label: string, o?: TextOpts) => TextElement;
  // A heading: bold, ink.
  heading: (x: number, y: number, w: number, label: string, size?: number) => TextElement;
  // A filled rounded block (a picture's grey, a skeleton bar, a panel).
  block: (
    x: number,
    y: number,
    w: number,
    h: number,
    extra?: Partial<ShapeElement>,
  ) => ShapeElement;
  // A filled (primary), outlined (secondary) or bare (ghost) button.
  button: (
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    look?: 'primary' | 'secondary' | 'ghost',
  ) => ShapeElement;
  // An outlined field holding a muted placeholder, an icon before it where given.
  field: (
    x: number,
    y: number,
    w: number,
    h: number,
    placeholder: string,
    iconId?: string,
  ) => ShapeElement;
  // A field's label over it.
  labelled: (x: number, y: number, w: number, label: string, placeholder: string) => number;
  // A picture: a soft grey block with the image glyph at its middle.
  picture: (x: number, y: number, w: number, h: number, radius?: 'md' | 'lg' | 'none') => void;
  avatar: (x: number, y: number, d: number) => void;
  icon: (x: number, y: number, d: number, iconId: string, color?: string) => ShapeElement;
  // A pill-shaped chip, chosen (filled) or not.
  chip: (x: number, y: number, label: string, chosen?: boolean, h?: number) => number;
  // A thin rule.
  divider: (x: number, y: number, w: number) => ShapeElement;
  // A switch, on or off.
  toggle: (x: number, y: number, on?: boolean) => void;
  // An outlined card with a soft fill.
  card: (x: number, y: number, w: number, h: number) => ShapeElement;
  // Placeholder lines of text, as skeleton bars, `n` of them across `w`.
  lines: (x: number, y: number, w: number, n: number, pitch?: number) => number;
};

// A label's width at a size, generous so a button's or chip's word never wraps.
const advance = (label: string, size: number) => Math.ceil(label.length * size * 0.58);

export function ui(box: LayoutBox): Ui {
  const k = kit(box);
  const els: Element[] = [];
  const add = <E extends Element>(el: E): E => {
    els.push(el);
    return el;
  };
  const text: Ui['text'] = (x, y, w, h, label, o = {}) =>
    add(
      k.text(x, y, w, h, label, {
        textSize: o.size ?? 15,
        textColor: o.color ?? WF.body,
        textAlignX: o.align ?? 'left',
        textAlignY: o.alignY ?? 'middle',
        padding: 'none',
        ...(o.bold ? { textBold: true } : {}),
      }),
    );
  const block: Ui['block'] = (x, y, w, h, extra = {}) =>
    add(
      k.shape('square', x, y, w, h, {
        label: '',
        fillColor: WF.place,
        strokeWidth: 'none',
        borderRadius: 'md',
        ...extra,
      }),
    );
  const icon: Ui['icon'] = (x, y, d, iconId, color = WF.body) =>
    add(k.shape('icon', x, y, d, d, { iconId, strokeColor: color, textColor: color }));
  const u: Ui = {
    k,
    W: box.width,
    H: box.height,
    form: screenForm(box),
    els,
    text,
    heading: (x, y, w, label, size = 28) =>
      text(x, y, w, Math.round(size * 1.35), label, { size, bold: true, color: WF.ink }),
    block,
    button: (x, y, w, h, label, look = 'primary') =>
      add(
        k.shape('square', x, y, w, h, {
          label,
          textSize: h >= 44 ? 16 : 14,
          textBold: true,
          borderRadius: 'md',
          ...(look === 'primary'
            ? { fillColor: WF.ink, textColor: WF.white, strokeWidth: 'none' }
            : look === 'secondary'
              ? {
                  fillColor: WF.white,
                  textColor: WF.ink,
                  strokeColor: WF.line,
                  strokeWidth: 'thin',
                }
              : { fillColor: 'transparent', textColor: WF.ink, strokeWidth: 'none' }),
        }),
      ),
    field: (x, y, w, h, placeholder, iconId) =>
      add(
        k.shape('square', x, y, w, h, {
          label: placeholder,
          textSize: 15,
          textColor: WF.muted,
          textAlignX: 'left',
          fillColor: WF.white,
          strokeColor: WF.line,
          strokeWidth: 'thin',
          borderRadius: 'md',
          padding: 'md',
          ...(iconId ? { iconId } : {}),
        }),
      ),
    labelled: (x, y, w, label, placeholder) => {
      text(x, y, w, 20, label, { size: 13, bold: true, color: WF.body });
      u.field(x, y + 24, w, 48, placeholder);
      return y + 24 + 48;
    },
    picture: (x, y, w, h, radius = 'lg') => {
      block(x, y, w, h, { borderRadius: radius });
      const d = Math.max(16, Math.min(44, Math.round(Math.min(w, h) * 0.26)));
      icon(x + (w - d) / 2, y + (h - d) / 2, d, 'image', WF.muted);
    },
    avatar: (x, y, d) => {
      add(k.shape('circle', x, y, d, d, { label: '', fillColor: WF.place, strokeWidth: 'none' }));
      const g = Math.round(d * 0.5);
      icon(x + (d - g) / 2, y + (d - g) / 2, g, 'user', WF.muted);
    },
    icon,
    chip: (x, y, label, chosen = false, h = 34) => {
      const w = advance(label, 14) + 32;
      add(
        k.shape('square', x, y, w, h, {
          label,
          textSize: 14,
          borderRadius: 'full',
          ...(chosen
            ? { fillColor: WF.ink, textColor: WF.white, strokeWidth: 'none', textBold: true }
            : {
                fillColor: WF.white,
                textColor: WF.body,
                strokeColor: WF.line,
                strokeWidth: 'thin',
              }),
        }),
      );
      return w;
    },
    divider: (x, y, w) => block(x, y, w, 1, { fillColor: WF.line, borderRadius: 'none' }),
    toggle: (x, y, on = true) => {
      add(
        k.shape('stadium', x, y, 51, 31, {
          label: '',
          fillColor: on ? WF.ink : WF.place,
          strokeWidth: 'none',
        }),
      );
      add(
        k.shape('circle', on ? x + 22 : x + 2, y + 2, 27, 27, {
          label: '',
          fillColor: WF.white,
          strokeWidth: 'none',
        }),
      );
    },
    card: (x, y, w, h) =>
      block(x, y, w, h, {
        fillColor: WF.white,
        strokeColor: WF.line,
        strokeWidth: 'thin',
        borderRadius: 'lg',
      }),
    lines: (x, y, w, n, pitch = 18) => {
      for (let i = 0; i < n; i += 1)
        block(x, y + i * pitch, i === n - 1 && n > 1 ? w * 0.62 : w, 9, {
          borderRadius: 'full',
        });
      return y + n * pitch;
    },
  };
  return u;
}

// The common bars a screen is framed by.

/** A phone's top bar: an optional back arrow, a centred or leading title, an action glyph. */
export function topBar(
  u: Ui,
  title: string,
  { back = false, action }: { back?: boolean; action?: string } = {},
): number {
  if (back) u.icon(0, 8, 24, 'arrow-left', WF.ink);
  u.text(back ? 36 : 0, 0, u.W - (back ? 72 : 40), 40, title, {
    size: back ? 17 : 28,
    bold: true,
    color: WF.ink,
    align: back ? 'center' : 'left',
  });
  if (action) u.icon(u.W - 26, 8, 24, action, WF.ink);
  return 56;
}

/** A phone's tab bar at the foot of the safe area: a glyph and a word per tab, the first chosen. */
export function tabBar(u: Ui, tabs: readonly [string, string][] = PHONE_TABS): void {
  const y = u.H - 52;
  u.divider(-16, y - 8, u.W + 32);
  const step = u.W / tabs.length;
  tabs.forEach(([iconId, label], i) => {
    const color = i === 0 ? WF.ink : WF.muted;
    u.icon(step * i + step / 2 - 12, y + 2, 24, iconId, color);
    u.text(step * i, y + 30, step, 16, label, { size: 11, align: 'center', color, bold: i === 0 });
  });
}

export const PHONE_TABS: readonly [string, string][] = [
  ['home', 'Home'],
  ['search', 'Search'],
  ['bell', 'Inbox'],
  ['user', 'Profile'],
];

/** A computer's top navigation: the product's mark and name, links, and a button or avatar at the
 *  end. Answers the height it took. */
export function topNav(
  u: Ui,
  links: readonly string[] = ['Product', 'Pricing', 'Customers', 'Docs'],
  end: 'button' | 'avatar' = 'button',
): number {
  u.block(0, 8, 32, 32, { fillColor: WF.ink, borderRadius: 'md' });
  u.icon(6, 14, 20, 'zap', WF.white);
  u.text(44, 4, 160, 40, APP_NAME, { size: 18, bold: true, color: WF.ink });
  // The links run until they would meet the end's buttons or avatar: a narrower screen shows fewer.
  const endRoom = end === 'button' ? 288 : 112;
  let x = 240;
  for (const link of links) {
    const w = advance(link, 15) + 8;
    if (x + w > u.W - endRoom) break;
    u.text(x, 4, w, 40, link, { size: 15, color: WF.body });
    x += w + 28;
  }
  if (end === 'button') {
    u.button(u.W - 268, 4, 112, 40, 'Log In', 'ghost');
    u.button(u.W - 148, 4, 148, 40, 'Get Started');
  } else {
    u.icon(u.W - 92, 12, 24, 'bell', WF.body);
    u.avatar(u.W - 48, 2, 44);
  }
  u.divider(0, 64, u.W);
  return 96;
}

/** A computer's sidebar of sections down the left, the first chosen. Answers its width. */
export function sideNav(u: Ui, items: readonly [string, string][], top = 0, w = 232): number {
  u.block(0, top, w, u.H - top, { fillColor: WF.soft, borderRadius: 'lg' });
  items.forEach(([iconId, label], i) => {
    const y = top + 16 + i * 48;
    if (i === 0)
      u.block(12, y, w - 24, 40, {
        fillColor: WF.white,
        strokeColor: WF.line,
        strokeWidth: 'thin',
      });
    u.icon(26, y + 9, 22, iconId, i === 0 ? WF.ink : WF.muted);
    u.text(60, y, w - 72, 40, label, {
      size: 15,
      bold: i === 0,
      color: i === 0 ? WF.ink : WF.body,
    });
  });
  return w;
}

// The placeholder product.
export const APP_NAME = 'Your App';

/**
 * The screen's elements fitted into its safe area: a screen built taller or wider than the area (a
 * phone turned landscape is short) is scaled down as one about the area's top-left, its type with
 * it, and centred across; one that fits is left as it is.
 */
/** The elements scaled by `s` about the box's top-left, their type with them. */
export function scaleFrom(els: Element[], box: LayoutBox, s: number, dx = 0): Element[] {
  const r = (n: number) => Math.round(n * 100) / 100;
  return els.map((el) => {
    if (el.type === 'arrow') return el;
    const size = 'textSize' in el && typeof el.textSize === 'number' ? el.textSize : undefined;
    return {
      ...el,
      x: r(box.x + dx + (el.x - box.x) * s),
      y: r(box.y + (el.y - box.y) * s),
      width: r(el.width * s),
      height: r(el.height * s),
      ...(size !== undefined ? { textSize: Math.max(8, Math.round(size * s)) } : {}),
    };
  });
}

export function fitToBox(els: Element[], box: LayoutBox): Element[] {
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const el of els) {
    if (el.type === 'arrow') continue;
    maxX = Math.max(maxX, el.x + el.width);
    maxY = Math.max(maxY, el.y + el.height);
  }
  const w = maxX - box.x;
  const h = maxY - box.y;
  const s = Math.min(1, box.width / Math.max(1, w), box.height / Math.max(1, h));
  if (s >= 0.999) return els;
  return scaleFrom(els, box, s, (box.width - w * s) / 2);
}
