// Wireframe layouts, Start and Browse (docs/specs/007-editor/wireframe-pages.md "Wireframe
// layouts"): each a whole screen, a single column on a phone and a wider arrangement on a tablet
// or computer. Pure builders over the safe area (wireframe-layout-kit).
import type { Element } from '@liveplanner/document';
import type { LayoutBox } from './page-layout-kit';
import {
  APP_NAME,
  fitToBox,
  scaleFrom,
  tabBar,
  topBar,
  topNav,
  ui,
  WF,
  type Ui,
} from './wireframe-layout-kit';
import { watchNotification } from './wireframe-layouts-watch';

// A wide screen shorter than this (a phone turned landscape) is laid out as if taller and scaled
// down to it, never by more than SHORT_SCALE_MIN, so its type stays readable.
const SHORT_HEIGHT = 600;
const SHORT_SCALE_MIN = 0.72;
// A tall screen (a tablet upright) that `column` suits takes the phone form in a centred column
// this wide.
const TALL_RATIO = 1.2;
const COLUMN_MAX = 560;

/**
 * A responsive builder: its phone and wide forms; a watch takes its Notification. `column`: on a
 * tall screen (a tablet upright) the phone form in a centred column suits it better than the wide
 * form's empty space (a sign in, a product).
 */
export function responsive(
  phone: (u: Ui) => void,
  wide: (u: Ui) => void,
  // `true`: a centred column; 'full': the phone form across the whole width (rows that read well wide).
  { column = false }: { column?: boolean | 'full' } = {},
) {
  return (box: LayoutBox): Element[] => {
    const probe = ui(box);
    if (probe.form === 'watch') return watchNotification(box);
    if (probe.form === 'phone') {
      phone(probe);
      return fitToBox(probe.els, box);
    }
    if (column && box.height > box.width * TALL_RATIO) {
      const w = column === 'full' ? box.width : Math.min(COLUMN_MAX, box.width);
      const u = ui({ ...box, x: box.x + (box.width - w) / 2, width: w });
      phone(u);
      return fitToBox(u.els, box);
    }
    if (box.height < SHORT_HEIGHT) {
      const s = Math.max(SHORT_SCALE_MIN, box.height / SHORT_HEIGHT);
      const virtual = { ...box, width: box.width / s, height: box.height / s };
      const u = ui(virtual);
      wide(u);
      return fitToBox(scaleFrom(u.els, box, s), box);
    }
    wide(probe);
    return fitToBox(probe.els, box);
  };
}

// The progress dots under an onboarding step, the first long.
function dots(u: Ui, x: number, y: number) {
  u.block(x, y, 24, 8, { fillColor: WF.ink, borderRadius: 'full' });
  u.block(x + 32, y, 8, 8, { fillColor: WF.line, borderRadius: 'full' });
  u.block(x + 48, y, 8, 8, { fillColor: WF.line, borderRadius: 'full' });
}

export const onboarding = responsive(
  (u) => {
    const { W, H } = u;
    u.text(W - 60, 0, 60, 32, 'Skip', { size: 15, bold: true, align: 'right', color: WF.muted });
    const pic = Math.round(H * 0.46);
    u.picture(0, 44, W, pic);
    const y = 44 + pic + 36;
    u.text(0, y, W, 76, 'Plan Your Week in Minutes', {
      size: 28,
      bold: true,
      color: WF.ink,
      alignY: 'top',
    });
    u.text(0, y + 84, W, 48, 'Everything you need in one place, ready whenever you are.', {
      size: 16,
      color: WF.muted,
      alignY: 'top',
    });
    dots(u, (W - 56) / 2, H - 96);
    u.button(0, H - 56, W, 56, 'Continue');
  },
  (u) => {
    const { W, H } = u;
    const col = Math.round(W * 0.44);
    const pic = { x: col + 48, w: W - col - 48 };
    u.picture(pic.x, 0, pic.w, H);
    const y = Math.round(H * 0.24);
    u.chip(0, y, 'New', true, 30);
    u.text(0, y + 52, col, 140, 'Plan Your Week in Minutes', {
      size: Math.min(52, Math.round(col / 9)),
      bold: true,
      color: WF.ink,
      alignY: 'top',
    });
    u.text(0, y + 204, col, 56, 'Everything you need in one place, ready whenever you are.', {
      size: 18,
      color: WF.muted,
      alignY: 'top',
    });
    u.button(0, y + 284, 176, 52, 'Get Started');
    u.button(192, y + 284, 128, 52, 'Sign In', 'secondary');
    dots(u, 0, y + 372);
  },
  { column: true },
);

export const signIn = responsive(
  (u) => {
    const { W, H } = u;
    let y = 40;
    u.block((W - 56) / 2, y, 56, 56, { fillColor: WF.ink, borderRadius: 'lg' });
    u.icon((W - 28) / 2, y + 14, 28, 'zap', WF.white);
    y += 80;
    u.text(0, y, W, 38, 'Welcome Back', { size: 28, bold: true, color: WF.ink, align: 'center' });
    u.text(0, y + 40, W, 24, `Sign in to ${APP_NAME}`, {
      size: 15,
      color: WF.muted,
      align: 'center',
    });
    y = u.labelled(0, y + 92, W, 'Email', 'you@example.com') + 16;
    y = u.labelled(0, y, W, 'Password', '••••••••') + 12;
    u.text(0, y, W, 22, 'Forgot Password?', {
      size: 14,
      bold: true,
      color: WF.ink,
      align: 'right',
    });
    u.button(0, y + 40, W, 52, 'Sign In');
    u.divider(0, y + 124, W);
    u.button(0, y + 148, W, 52, 'Continue with Google', 'secondary');
    u.text(0, H - 24, W, 24, 'New here? Create Account', {
      size: 14,
      color: WF.muted,
      align: 'center',
    });
  },
  (u) => {
    const { W, H } = u;
    const half = Math.round(W * 0.5);
    u.picture(0, 0, half - 24, H);
    const fw = Math.min(400, W - half - 48);
    const x = half + Math.round((W - half - fw) / 2);
    let y = Math.max(24, Math.round(H / 2 - 260));
    u.block(x, y, 48, 48, { fillColor: WF.ink, borderRadius: 'lg' });
    u.icon(x + 12, y + 12, 24, 'zap', WF.white);
    y += 76;
    u.text(x, y, fw, 40, 'Welcome Back', { size: 32, bold: true, color: WF.ink });
    u.text(x, y + 44, fw, 24, `Sign in to ${APP_NAME}`, { size: 16, color: WF.muted });
    y = u.labelled(x, y + 96, fw, 'Email', 'you@example.com') + 16;
    y = u.labelled(x, y, fw, 'Password', '••••••••') + 12;
    u.text(x, y, fw, 22, 'Forgot Password?', {
      size: 14,
      bold: true,
      color: WF.ink,
      align: 'right',
    });
    u.button(x, y + 40, fw, 52, 'Sign In');
    u.button(x, y + 108, fw, 52, 'Continue with Google', 'secondary');
    u.text(x, y + 180, fw, 24, 'New here? Create Account', {
      size: 14,
      color: WF.muted,
      align: 'center',
    });
  },
  { column: true },
);

function emptyMiddle(u: Ui, x: number, w: number, cy: number) {
  const d = 96;
  u.els.push(
    u.k.shape('circle', x + (w - d) / 2, cy - 150, d, d, {
      label: '',
      fillColor: WF.soft,
      strokeWidth: 'none',
    }),
  );
  u.icon(x + (w - 40) / 2, cy - 150 + 28, 40, 'folder', WF.muted);
  u.text(x, cy - 30, w, 36, 'Nothing Here Yet', {
    size: 24,
    bold: true,
    color: WF.ink,
    align: 'center',
  });
  u.text(x, cy + 10, w, 48, 'Projects you create will show up here.', {
    size: 16,
    color: WF.muted,
    align: 'center',
    alignY: 'top',
  });
  const bw = Math.min(w, 260);
  u.button(x + (w - bw) / 2, cy + 72, bw, 52, 'Create a Project');
}

export const emptyState = responsive(
  (u) => {
    const top = topBar(u, 'Projects', { action: 'plus' });
    emptyMiddle(u, 0, u.W, top + (u.H - top - 60) / 2);
    tabBar(u);
  },
  (u) => {
    const top = topNav(u, ['Projects', 'Team', 'Reports'], 'avatar');
    emptyMiddle(u, 0, u.W, top + (u.H - top) / 2);
  },
  { column: true },
);

// A card of a picture over a title and a line.
function feedCard(u: Ui, x: number, y: number, w: number, pic: number, title: string) {
  u.picture(x, y, w, pic);
  u.text(x, y + pic + 10, w, 24, title, { size: 16, bold: true, color: WF.ink });
  u.text(x, y + pic + 36, w, 20, '12 min · Saved by 1.2k people', { size: 13, color: WF.muted });
  return y + pic + 72;
}

const FEED_TITLES = [
  'Weekend in the Hills',
  'A Slower Morning',
  'City Food Guide',
  'Notes on Design',
];
const CHIPS = ['All', 'Travel', 'Food', 'Design', 'Music'];

function chipsRow(u: Ui, y: number, max: number) {
  let x = 0;
  CHIPS.forEach((c, i) => {
    if (x > max - 60) return;
    x += u.chip(x, y, c, i === 0) + 8;
  });
}

export const homeFeed = responsive(
  (u) => {
    const { W, H } = u;
    let y = topBar(u, 'Discover', { action: 'bell' });
    u.field(0, y, W, 44, 'Search', 'search');
    chipsRow(u, y + 60, W);
    y += 114;
    const pic = 168;
    for (let i = 0; y + pic + 72 <= H - 64; i += 1)
      y = feedCard(u, 0, y, W, pic, FEED_TITLES[i % 4]!) + 12;
    tabBar(u);
  },
  (u) => {
    const { W, H } = u;
    let y = topNav(u, ['Discover', 'Saved', 'Following'], 'avatar');
    u.heading(0, y, 400, 'Discover', 32);
    u.field(W - Math.min(420, W * 0.4), y, Math.min(420, W * 0.4), 44, 'Search', 'search');
    chipsRow(u, y + 64, W);
    y += 124;
    const cols = W >= 1200 ? 4 : W >= 900 ? 3 : 2;
    const gap = 24;
    const cw = (W - gap * (cols - 1)) / cols;
    // At least one row of cards, however short the screen.
    const pic = Math.round(Math.max(80, Math.min(cw * 0.62, H - y - 80)));
    for (let row = 0; row === 0 || y + pic + 72 <= H; row += 1) {
      for (let c = 0; c < cols; c += 1)
        feedCard(u, c * (cw + gap), y, cw, pic, FEED_TITLES[(row * cols + c) % 4]!);
      y += pic + 72 + 24;
    }
  },
);

const FEATURES: readonly [string, string, string][] = [
  ['zap', 'Fast to Start', 'Set up in minutes, no training needed.'],
  ['users', 'Built for Teams', 'Invite everyone and work together live.'],
  ['lock', 'Private by Default', 'Your data stays yours, always.'],
];

export const landingPage = responsive(
  (u) => {
    const { W, H } = u;
    u.block(0, 4, 28, 28, { fillColor: WF.ink, borderRadius: 'md' });
    u.icon(5, 9, 18, 'zap', WF.white);
    u.text(38, 0, 160, 36, APP_NAME, { size: 17, bold: true, color: WF.ink });
    u.icon(W - 26, 6, 24, 'menu', WF.ink);
    let y = 64;
    u.chip(0, y, 'New: Team Spaces', false, 30);
    u.text(0, y + 46, W, 120, 'Work Together, Wherever You Are', {
      size: 34,
      bold: true,
      color: WF.ink,
      alignY: 'top',
    });
    u.text(0, y + 176, W, 48, 'One calm place for your team’s plans, notes and files.', {
      size: 16,
      color: WF.muted,
      alignY: 'top',
    });
    u.button(0, y + 240, W, 52, 'Start Free');
    u.button(0, y + 304, W, 52, 'Book a Demo', 'secondary');
    y += 380;
    const pic = Math.min(220, H - y);
    if (pic > 80) u.picture(0, y, W, pic);
  },
  (u) => {
    const { W, H } = u;
    let y = topNav(u);
    const col = Math.round(W * 0.46);
    const heroH = Math.round(Math.min(H * 0.56, 480));
    u.chip(0, y + 24, 'New: Team Spaces', false, 30);
    u.text(0, y + 72, col, 150, 'Work Together, Wherever You Are', {
      size: Math.min(56, Math.round(col / 10)),
      bold: true,
      color: WF.ink,
      alignY: 'top',
    });
    u.text(0, y + 232, col, 56, 'One calm place for your team’s plans, notes and files.', {
      size: 18,
      color: WF.muted,
      alignY: 'top',
    });
    u.button(0, y + 312, 160, 52, 'Start Free');
    u.button(176, y + 312, 160, 52, 'Book a Demo', 'secondary');
    u.picture(col + 48, y, W - col - 48, heroH);
    y += heroH + 48;
    const gap = 24;
    const cw = (W - 2 * gap) / 3;
    const ch = Math.min(180, H - y);
    if (ch < 120) return;
    FEATURES.forEach(([iconId, title, line], i) => {
      const x = i * (cw + gap);
      u.card(x, y, cw, ch);
      u.block(x + 24, y + 24, 44, 44, { fillColor: WF.soft, borderRadius: 'md' });
      u.icon(x + 34, y + 34, 24, iconId, WF.ink);
      u.text(x + 24, y + 84, cw - 48, 26, title, { size: 18, bold: true, color: WF.ink });
      u.text(x + 24, y + 114, cw - 48, 44, line, { size: 15, color: WF.muted, alignY: 'top' });
    });
  },
);

function productInfo(u: Ui, x: number, y: number, w: number, bottom: number) {
  u.text(x, y, w, 34, 'Product Name', { size: 26, bold: true, color: WF.ink });
  u.text(x, y + 38, w, 28, '$49.00', { size: 22, bold: true, color: WF.ink });
  u.text(x, y + 72, w, 20, '★★★★★  4.8 (128 reviews)', { size: 14, color: WF.muted });
  let at = u.lines(x, y + 112, w, 3);
  u.text(x, at + 12, w, 22, 'Size', { size: 15, bold: true, color: WF.ink });
  let cx = x;
  ['S', 'M', 'L', 'XL'].forEach((s, i) => {
    cx += u.chip(cx, at + 44, s, i === 1, 40) + 8;
  });
  at += 104;
  u.button(x, Math.max(at, bottom - 56), w, 56, 'Add to Cart');
}

export const productDetail = responsive(
  (u) => {
    const { W, H } = u;
    const top = topBar(u, '', { back: true, action: 'heart' });
    const pic = Math.round(Math.min(W * 0.92, H * 0.42));
    u.picture(0, top, W, pic);
    productInfo(u, 0, top + pic + 20, W, H);
  },
  (u) => {
    const { W, H } = u;
    const y = topNav(u, ['Shop', 'New In', 'Sale'], 'avatar');
    const pic = Math.round(W * 0.52);
    u.picture(0, y, pic, H - y);
    const x = pic + 48;
    u.text(x, y, W - x, 20, 'Home  /  Shop  /  Product', { size: 13, color: WF.muted });
    productInfo(u, x, y + 40, W - x, Math.min(H, y + 520));
  },
  { column: true },
);

const RESULTS = [
  'Linen Shirt',
  'Canvas Tote',
  'Wool Scarf',
  'Leather Belt',
  'Cotton Cap',
  'Field Jacket',
  'Knit Beanie',
];

function resultRow(u: Ui, x: number, y: number, w: number, i: number, thumb = 64) {
  u.picture(x, y, thumb, thumb, 'md');
  u.text(x + thumb + 16, y + 6, w - thumb - 100, 22, RESULTS[i % RESULTS.length]!, {
    size: 16,
    bold: true,
    color: WF.ink,
  });
  u.text(x + thumb + 16, y + 32, w - thumb - 100, 20, 'In stock · Ships tomorrow', {
    size: 13,
    color: WF.muted,
  });
  u.text(x + w - 80, y + 6, 80, 22, `$${24 + i * 6}.00`, {
    size: 15,
    bold: true,
    color: WF.ink,
    align: 'right',
  });
}

export const searchResults = responsive(
  (u) => {
    const { W, H } = u;
    u.icon(0, 10, 24, 'arrow-left', WF.ink);
    u.field(36, 0, W - 36, 44, 'Linen', 'search');
    u.text(0, 60, W, 22, '24 results', { size: 14, color: WF.muted });
    let y = 96;
    for (let i = 0; y + 64 <= H; i += 1) {
      resultRow(u, 0, y, W, i);
      u.divider(80, y + 76, W - 80);
      y += 88;
    }
  },
  (u) => {
    const { W, H } = u;
    let y = topNav(u, ['Shop', 'New In', 'Sale'], 'avatar');
    u.field(0, y, W, 52, 'Linen', 'search');
    y += 84;
    const side = 220;
    u.text(0, y, side, 24, 'Filters', { size: 16, bold: true, color: WF.ink });
    ['Shirts', 'Bags', 'Accessories', 'Outerwear', 'On Sale'].forEach((f, i) => {
      u.block(0, y + 44 + i * 36, 18, 18, {
        fillColor: i < 2 ? WF.ink : WF.white,
        strokeColor: WF.line,
        strokeWidth: i < 2 ? 'none' : 'thin',
        borderRadius: 'sm',
      });
      u.text(30, y + 39 + i * 36, side - 30, 28, f, { size: 15, color: WF.body });
    });
    const x = side + 40;
    u.text(x, y, W - x, 24, '24 results for “Linen”', { size: 16, bold: true, color: WF.ink });
    y += 48;
    for (let i = 0; y + 80 <= H; i += 1) {
      resultRow(u, x, y, W - x, i, 80);
      u.divider(x, y + 96, W - x);
      y += 112;
    }
  },
);
