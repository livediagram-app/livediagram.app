// Wireframe layouts, Account (docs/specs/007-editor/wireframe-pages.md "Wireframe layouts"):
// profile, settings, checkout and pricing, each a phone column or a wider arrangement. Pure builders over the safe area (wireframe-layout-kit).
import { sideNav, tabBar, topBar, topNav, WF, type Ui } from './wireframe-layout-kit';
import { responsive } from './wireframe-layouts-start';

function stats(u: Ui, x: number, y: number, w: number) {
  const items: [string, string][] = [
    ['248', 'Posts'],
    ['12.4k', 'Followers'],
    ['310', 'Following'],
  ];
  const step = w / items.length;
  items.forEach(([n, label], i) => {
    u.text(x + i * step, y, step, 28, n, { size: 20, bold: true, color: WF.ink, align: 'center' });
    u.text(x + i * step, y + 28, step, 20, label, { size: 13, color: WF.muted, align: 'center' });
  });
}

function pictureGrid(
  u: Ui,
  x: number,
  y: number,
  w: number,
  bottom: number,
  cols: number,
  gap = 4,
) {
  const s = (w - gap * (cols - 1)) / cols;
  for (let row = 0; y + row * (s + gap) + s <= bottom; row += 1)
    for (let c = 0; c < cols; c += 1)
      u.picture(x + c * (s + gap), y + row * (s + gap), s, s, 'none');
}

export const profile = responsive(
  (u) => {
    const { W, H } = u;
    let y = topBar(u, 'Profile', { action: 'settings' });
    u.avatar((W - 96) / 2, y, 96);
    u.text(0, y + 108, W, 30, 'Jordan Lee', {
      size: 22,
      bold: true,
      color: WF.ink,
      align: 'center',
    });
    u.text(0, y + 138, W, 22, '@jordan · Product designer', {
      size: 14,
      color: WF.muted,
      align: 'center',
    });
    stats(u, 0, y + 180, W);
    y += 252;
    u.button(0, y, (W - 12) / 2, 44, 'Edit Profile', 'secondary');
    u.button((W + 12) / 2, y, (W - 12) / 2, 44, 'Share');
    pictureGrid(u, 0, y + 64, W, H - 60, 3);
    tabBar(u);
  },
  (u) => {
    const { W, H } = u;
    let y = topNav(u, ['Home', 'Explore', 'Messages'], 'avatar');
    u.picture(0, y, W, 200);
    u.avatar(40, y + 140, 128);
    u.text(188, y + 212, 400, 34, 'Jordan Lee', { size: 28, bold: true, color: WF.ink });
    u.text(188, y + 248, 400, 22, '@jordan · Product designer', { size: 15, color: WF.muted });
    u.button(W - 312, y + 216, 148, 44, 'Edit Profile', 'secondary');
    u.button(W - 152, y + 216, 152, 44, 'Share');
    stats(u, 0, y + 300, Math.min(480, W));
    y += 380;
    pictureGrid(u, 0, y, W, H, W >= 1200 ? 5 : 4, 16);
  },
);

type Row = { label: string; toggle?: boolean; on?: boolean; value?: string };

// A group of settings rows in a card: a label and a switch, or a value and a chevron.
function rowsCard(u: Ui, x: number, y: number, w: number, title: string, rows: readonly Row[]) {
  u.text(x, y, w, 22, title.toUpperCase(), { size: 12, bold: true, color: WF.muted });
  const top = y + 30;
  u.card(x, top, w, rows.length * 56);
  rows.forEach((r, i) => {
    const ry = top + i * 56;
    if (i > 0) u.divider(x + 16, ry, w - 16);
    u.text(x + 16, ry, w - 140, 56, r.label, { size: 16, color: WF.ink });
    if (r.toggle) u.toggle(x + w - 67, ry + 12, r.on);
    else {
      u.text(x + w - 140, ry, 100, 56, r.value ?? '', {
        size: 15,
        color: WF.muted,
        align: 'right',
      });
      u.text(x + w - 36, ry, 20, 56, '›', { size: 22, color: WF.muted, align: 'center' });
    }
  });
  return top + rows.length * 56 + 28;
}

const ACCOUNT: readonly Row[] = [
  { label: 'Profile', value: 'Jordan' },
  { label: 'Password' },
  { label: 'Notifications', toggle: true, on: true },
];
const PREFERENCES: readonly Row[] = [
  { label: 'Dark Mode', toggle: true, on: false },
  { label: 'Language', value: 'English' },
  { label: 'Units', value: 'Metric' },
];

export const settings = responsive(
  (u) => {
    const { W, H } = u;
    let y = topBar(u, 'Settings');
    y = rowsCard(u, 0, y, W, 'Account', ACCOUNT);
    if (y + 30 + PREFERENCES.length * 56 <= H - 80)
      y = rowsCard(u, 0, y, W, 'Preferences', PREFERENCES);
    if (y + 52 <= H - 60) u.button(0, y, W, 52, 'Log Out', 'secondary');
    tabBar(u);
  },
  (u) => {
    const { W } = u;
    const top = topNav(u, ['Home', 'Projects', 'Team'], 'avatar');
    const side = sideNav(
      u,
      [
        ['user', 'Account'],
        ['bell', 'Notifications'],
        ['lock', 'Privacy'],
        ['credit-card', 'Billing'],
        ['sliders', 'Preferences'],
      ],
      top,
    );
    const x = side + 48;
    const w = Math.min(720, W - x);
    u.heading(x, top, w, 'Account', 30);
    let y = rowsCard(u, x, top + 64, w, 'Account', ACCOUNT);
    y = rowsCard(u, x, y, w, 'Preferences', PREFERENCES);
    u.button(x, y, 140, 44, 'Log Out', 'secondary');
  },
);

function summary(u: Ui, x: number, y: number, w: number): number {
  u.card(x, y, w, 196);
  const line = (at: number, label: string, value: string, bold = false) => {
    u.text(x + 20, at, w - 140, 24, label, { size: 15, color: bold ? WF.ink : WF.body, bold });
    u.text(x + w - 140, at, 120, 24, value, { size: 15, color: WF.ink, bold, align: 'right' });
  };
  u.text(x + 20, y + 18, w - 40, 24, 'Order Summary', { size: 16, bold: true, color: WF.ink });
  line(y + 60, 'Subtotal', '$49.00');
  line(y + 92, 'Delivery', '$5.00');
  u.divider(x + 20, y + 130, w - 40);
  line(y + 148, 'Total', '$54.00', true);
  return y + 196;
}

function paymentForm(u: Ui, x: number, y: number, w: number): number {
  u.text(x, y, w, 24, 'Delivery', { size: 18, bold: true, color: WF.ink });
  y = u.labelled(x, y + 36, w, 'Full Name', 'Jordan Lee') + 16;
  y = u.labelled(x, y, w, 'Address', '12 High Street') + 28;
  u.text(x, y, w, 24, 'Payment', { size: 18, bold: true, color: WF.ink });
  u.field(x, y + 36, w, 48, '1234 5678 9012 3456', 'credit-card');
  const half = (w - 12) / 2;
  u.field(x, y + 96, half, 48, 'MM / YY');
  u.field(x + half + 12, y + 96, half, 48, 'CVC');
  return y + 144;
}

export const checkout = responsive(
  (u) => {
    const { W, H } = u;
    const y = paymentForm(u, 0, topBar(u, 'Checkout', { back: true }), W) + 24;
    if (y + 196 <= H - 72) summary(u, 0, y, W);
    u.button(0, H - 56, W, 56, 'Pay $54.00');
  },
  (u) => {
    const { W } = u;
    const top = topNav(u, ['Shop', 'New In', 'Sale'], 'avatar');
    u.heading(0, top, 400, 'Checkout', 32);
    const col = Math.round(W * 0.56);
    paymentForm(u, 0, top + 72, col);
    const sx = col + 48;
    const y = summary(u, sx, top + 72, W - sx);
    u.button(sx, y + 24, W - sx, 56, 'Pay $54.00');
  },
);

const PLANS: readonly [string, string, string[]][] = [
  ['Starter', '$0', ['1 project', 'Basic support']],
  ['Team', '$12', ['Unlimited projects', 'Shared spaces', 'Priority support']],
  ['Business', '$29', ['Everything in Team', 'Admin controls', 'SSO']],
];

function planCard(u: Ui, x: number, y: number, w: number, h: number, i: number) {
  const [name, price, features] = PLANS[i]!;
  const popular = i === 1;
  u.block(x, y, w, h, {
    fillColor: WF.white,
    strokeColor: popular ? WF.ink : WF.line,
    strokeWidth: popular ? 'medium' : 'thin',
    borderRadius: 'lg',
  });
  u.text(x + 20, y + 18, w - 140, 24, name, { size: 17, bold: true, color: WF.ink });
  if (popular) u.chip(x + w - 104, y + 16, 'Popular', true, 28);
  u.text(x + 20, y + 48, w - 40, 44, `${price}/mo`, { size: 32, bold: true, color: WF.ink });
  let fy = y + 104;
  for (const f of features) {
    if (fy + 24 > y + h - 64) break;
    u.icon(x + 20, fy + 2, 18, 'check', WF.ink);
    u.text(x + 46, fy, w - 66, 22, f, { size: 14, color: WF.body });
    fy += 28;
  }
  u.button(
    x + 20,
    y + h - 60,
    w - 40,
    44,
    popular ? 'Start Trial' : 'Choose',
    popular ? 'primary' : 'secondary',
  );
}

export const pricing = responsive(
  (u) => {
    const { W, H } = u;
    u.text(0, 0, W, 36, 'Simple Pricing', { size: 28, bold: true, color: WF.ink, align: 'center' });
    const mw = 96 + 88;
    u.chip((W - mw) / 2, 48, 'Monthly', true, 32);
    u.chip((W - mw) / 2 + 102, 48, 'Yearly', false, 32);
    const top = 100;
    const h = Math.min(220, (H - top - 24) / 3);
    for (let i = 0; i < 3; i += 1) planCard(u, 0, top + i * (h + 12), W, h - 0, i);
  },
  (u) => {
    const { W, H } = u;
    const top = topNav(u);
    u.text(0, top, W, 48, 'Simple Pricing', {
      size: 40,
      bold: true,
      color: WF.ink,
      align: 'center',
    });
    u.text(0, top + 56, W, 26, 'Start free, upgrade when your team grows.', {
      size: 18,
      color: WF.muted,
      align: 'center',
    });
    const gap = 24;
    const cw = Math.min(360, (W - 2 * gap) / 3);
    const x0 = (W - 3 * cw - 2 * gap) / 2;
    const h = Math.min(400, H - top - 120);
    for (let i = 0; i < 3; i += 1) planCard(u, x0 + i * (cw + gap), top + 120, cw, h, i);
  },
);
