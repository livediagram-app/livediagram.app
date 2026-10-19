// Wireframe layouts, Work (docs/specs/007-editor/wireframe-pages.md "Wireframe layouts"): a
// dashboard, a chat and a data table, each a phone column or a wider arrangement. Pure builders
// over the safe area (wireframe-layout-kit).
import { sideNav, tabBar, topBar, WF, type Ui } from './wireframe-layout-kit';
import { responsive } from './wireframe-layouts-start';

// The narrowest the Recent Orders list is drawn (an avatar, an order and its amount).
const RECENT_MIN = 260;

// Charts in wireframe greys with real-looking data and no legend.
const WEEK_BARS = {
  label: '',
  chartLegend: false,
  pieSlices: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, i) => ({
    label,
    value: [42, 58, 51, 74, 66, 38, 47][i]!,
    color: i === 3 ? WF.ink : WF.line,
  })),
};
const REVENUE_LINES = {
  label: '',
  chartLegend: false,
  chartAxis: true,
  lineCategories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
  lineSeries: [
    { name: 'This year', color: WF.ink, values: [32, 41, 38, 52, 49, 63] },
    { name: 'Last year', color: WF.line, values: [28, 30, 35, 33, 40, 44] },
  ],
};

const FIGURES: readonly [string, string, string][] = [
  ['Revenue', '$48.2k', '▲ 12%'],
  ['Orders', '1,284', '▲ 8%'],
  ['Visitors', '32.1k', '▼ 3%'],
  ['Conversion', '4.1%', '▲ 0.4%'],
];

function figure(u: Ui, x: number, y: number, w: number, h: number, i: number) {
  const [label, value, delta] = FIGURES[i]!;
  u.card(x, y, w, h);
  u.text(x + 16, y + 14, w - 32, 20, label, { size: 13, color: WF.muted });
  u.text(x + 16, y + 36, w - 32, 34, value, { size: 24, bold: true, color: WF.ink });
  u.text(x + 16, y + h - 32, w - 32, 20, delta, { size: 13, bold: true, color: WF.body });
}

export const dashboard = responsive(
  (u) => {
    const { W, H } = u;
    let y = topBar(u, 'Overview', { action: 'bell' });
    const half = (W - 12) / 2;
    for (let i = 0; i < 4; i += 1)
      figure(u, (i % 2) * (half + 12), y + Math.floor(i / 2) * 124, half, 112, i);
    y += 248;
    const ch = Math.min(220, H - y - 72);
    if (ch > 120) {
      u.card(0, y, W, ch);
      u.text(16, y + 12, W - 32, 22, 'This Week', { size: 15, bold: true, color: WF.ink });
      u.els.push(u.k.shape('bar-chart', 16, y + 44, W - 32, ch - 60, WEEK_BARS));
    }
    tabBar(u);
  },
  (u) => {
    const { W, H } = u;
    const side = sideNav(u, [
      ['activity', 'Overview'],
      ['bar-chart', 'Reports'],
      ['users', 'Customers'],
      ['package', 'Products'],
      ['settings', 'Settings'],
    ]);
    const x = side + 32;
    const w = W - x;
    u.heading(x, 0, 400, 'Overview', 30);
    u.chip(x + w - 140, 4, 'Last 30 days', false, 34);
    const gap = 20;
    const fw = (w - 3 * gap) / 4;
    for (let i = 0; i < 4; i += 1) figure(u, x + i * (fw + gap), 64, fw, 120, i);
    const y = 208;
    // The list beside the chart only while it has room for its rows; else the chart takes the width.
    const list = w * 0.36 - gap >= RECENT_MIN;
    const cw = list ? Math.round(w * 0.64) : w;
    const ch = H - y;
    u.card(x, y, cw, ch);
    u.text(x + 20, y + 16, cw - 40, 24, 'Revenue', { size: 16, bold: true, color: WF.ink });
    u.els.push(u.k.shape('line-chart', x + 20, y + 56, cw - 40, ch - 76, REVENUE_LINES));
    if (!list) return;
    const lx = x + cw + gap;
    const lw = w - cw - gap;
    u.card(lx, y, lw, ch);
    u.text(lx + 20, y + 16, lw - 40, 24, 'Recent Orders', { size: 16, bold: true, color: WF.ink });
    for (let i = 0; y + 64 + i * 56 + 40 <= y + ch; i += 1) {
      const ry = y + 60 + i * 56;
      u.avatar(lx + 20, ry, 36);
      u.text(lx + 68, ry - 2, lw - 160, 20, `Order #${1042 + i}`, {
        size: 14,
        bold: true,
        color: WF.ink,
      });
      u.text(lx + 68, ry + 18, lw - 160, 18, '2 items', { size: 12, color: WF.muted });
      u.text(lx + lw - 100, ry, 80, 36, `$${38 + i * 7}.00`, {
        size: 14,
        bold: true,
        color: WF.ink,
        align: 'right',
      });
    }
  },
);

const MESSAGES: readonly [boolean, string][] = [
  [false, 'Hey! Are we still on for Friday?'],
  [true, 'Yes, 7pm works for me.'],
  [false, 'Great. I’ll book the table.'],
  [true, 'Perfect, see you there!'],
  [false, 'Bring the photos from the trip?'],
  [true, 'Will do.'],
];

function conversation(u: Ui, x: number, y: number, w: number, bottom: number) {
  for (const [mine, line] of MESSAGES) {
    const bw = Math.min(w * 0.72, line.length * 8.6 + 32);
    const lines = Math.ceil((line.length * 8.6) / (bw - 32));
    const bh = 20 * lines + 22;
    if (y + bh > bottom - 72) break;
    u.block(mine ? x + w - bw : x, y, bw, bh, {
      label: line,
      textSize: 15,
      textAlignX: 'left',
      padding: 'md',
      fillColor: mine ? WF.ink : WF.soft,
      textColor: mine ? WF.white : WF.ink,
      borderRadius: 'lg',
    });
    y += bh + 12;
  }
  u.field(x, bottom - 48, w - 60, 48, 'Message');
  u.els.push(
    u.k.shape('circle', x + w - 48, bottom - 48, 48, 48, {
      label: '',
      fillColor: WF.ink,
      strokeWidth: 'none',
    }),
  );
  u.icon(x + w - 36, bottom - 36, 24, 'send', WF.white);
}

export const chat = responsive(
  (u) => {
    const { W, H } = u;
    u.icon(0, 12, 24, 'arrow-left', WF.ink);
    u.avatar(36, 0, 44);
    u.text(92, 0, W - 130, 24, 'Alex Morgan', { size: 16, bold: true, color: WF.ink });
    u.text(92, 22, W - 130, 20, 'Online', { size: 13, color: WF.muted });
    u.icon(W - 26, 12, 24, 'more-horizontal', WF.ink);
    u.divider(-16, 60, W + 32);
    conversation(u, 0, 80, W, H);
  },
  (u) => {
    const { W, H } = u;
    const side = Math.min(340, Math.round(W * 0.3));
    u.heading(0, 0, side, 'Messages', 26);
    u.field(0, 52, side, 44, 'Search', 'search');
    const people = [
      'Alex Morgan',
      'Sam Rivera',
      'Priya Patel',
      'Chris Wong',
      'Mia Novak',
      'Leo Grant',
    ];
    people.forEach((p, i) => {
      const y = 116 + i * 72;
      if (y + 56 > H) return;
      if (i === 0) u.block(0, y - 6, side, 68, { fillColor: WF.soft, borderRadius: 'lg' });
      u.avatar(12, y, 48);
      u.text(72, y + 2, side - 84, 22, p, { size: 15, bold: true, color: WF.ink });
      u.text(72, y + 26, side - 84, 20, 'Sounds good, thanks!', { size: 13, color: WF.muted });
    });
    const x = side + 32;
    u.block(side + 15, 0, 1, H, { fillColor: WF.line, borderRadius: 'none' });
    u.avatar(x, 0, 44);
    u.text(x + 56, 0, 300, 24, 'Alex Morgan', { size: 16, bold: true, color: WF.ink });
    u.text(x + 56, 22, 300, 20, 'Online', { size: 13, color: WF.muted });
    u.divider(x, 60, W - x);
    conversation(u, x, 84, W - x, H);
  },
);

const ORDERS: readonly [string, string, string, string][] = [
  ['#1042', 'Jordan Lee', 'Paid', '$54.00'],
  ['#1041', 'Sam Rivera', 'Pending', '$120.00'],
  ['#1040', 'Priya Patel', 'Paid', '$32.50'],
  ['#1039', 'Chris Wong', 'Refunded', '$18.00'],
  ['#1038', 'Mia Novak', 'Paid', '$76.20'],
  ['#1037', 'Leo Grant', 'Pending', '$44.00'],
  ['#1036', 'Ava Brooks', 'Paid', '$91.10'],
  ['#1035', 'Noah Kim', 'Paid', '$27.00'],
];

function status(u: Ui, x: number, y: number, label: string) {
  u.chip(x, y, label, label === 'Paid', 28);
}

export const dataTable = responsive(
  (u) => {
    const { W, H } = u;
    let y = topBar(u, 'Orders', { action: 'plus' });
    u.field(0, y, W, 44, 'Search orders', 'search');
    y += 64;
    for (let i = 0; y + 72 <= H - 64; i += 1) {
      const [id, who, st, amount] = ORDERS[i % ORDERS.length]!;
      u.card(0, y, W, 72);
      u.text(16, y + 12, W - 140, 22, `${id} · ${who}`, { size: 15, bold: true, color: WF.ink });
      u.text(16, y + 38, W - 140, 20, amount, { size: 14, color: WF.muted });
      status(u, W - 116, y + 22, st);
      y += 84;
    }
    tabBar(u);
  },
  (u) => {
    const { W, H } = u;
    const side = sideNav(u, [
      ['package', 'Orders'],
      ['users', 'Customers'],
      ['bar-chart', 'Reports'],
      ['settings', 'Settings'],
    ]);
    const x = side + 32;
    const w = W - x;
    u.heading(x, 0, 400, 'Orders', 30);
    u.button(x + w - 140, 0, 140, 44, 'New Order');
    u.field(x, 64, Math.min(360, w * 0.4), 44, 'Search orders', 'search');
    let cx = x + Math.min(360, w * 0.4) + 16;
    ['All', 'Paid', 'Pending', 'Refunded'].forEach((c, i) => {
      cx += u.chip(cx, 69, c, i === 0) + 8;
    });
    let y = 132;
    const cols = [0, 0.18, 0.5, 0.74];
    const heads = ['Order', 'Customer', 'Status', 'Amount'];
    u.block(x, y, w, 44, { fillColor: WF.soft, borderRadius: 'md' });
    heads.forEach((h, i) =>
      u.text(x + 20 + cols[i]! * w, y, 200, 44, h, { size: 13, bold: true, color: WF.muted }),
    );
    y += 44;
    for (let i = 0; y + 56 <= H; i += 1) {
      const row = ORDERS[i % ORDERS.length]!;
      row.forEach((cell, c) => {
        if (c === 2) status(u, x + 20 + cols[c]! * w, y + 14, cell);
        else
          u.text(x + 20 + cols[c]! * w, y, 220, 56, cell, {
            size: 15,
            color: c === 0 ? WF.ink : WF.body,
            bold: c === 0,
          });
      });
      u.divider(x, y + 56, w);
      y += 57;
    }
  },
);
