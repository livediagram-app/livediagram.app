// Wireframe layouts, the second set (docs/specs/007-editor/wireframe-pages.md "Wireframe layouts"):
// a calendar, an inbox, notifications, an article, places on a map, a music player and a photo
// gallery, each a phone column or a wider arrangement. Pure builders over the safe area
// (wireframe-layout-kit).
import { sideNav, tabBar, topBar, topNav, WF, type Ui } from './wireframe-layout-kit';
import { responsive } from './wireframe-layouts-start';

// A play triangle (a triangle turned to point right), centred on (cx, cy).
function playMark(u: Ui, cx: number, cy: number, d: number, color: string) {
  u.els.push(
    u.k.shape('triangle', cx - d / 2 + d * 0.08, cy - d / 2, d, d, {
      label: '',
      rotation: 90,
      fillColor: color,
      strokeColor: color,
      strokeWidth: 'none',
    }),
  );
}

// ---- Calendar ---------------------------------------------------------------------------------

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
// October 2026 starts on a Thursday; the 19th is today, some days hold events.
const FIRST = 4;
const TODAY = 19;
const BUSY = new Set([2, 7, 13, 19, 22, 28]);
const EVENTS: readonly [string, string, boolean][] = [
  ['Design Review', '10:00 – 11:00', true],
  ['Lunch with Sam', '12:30 – 13:30', false],
  ['Sprint Planning', '15:00 – 16:00', false],
  ['Gym', '18:00 – 19:00', false],
];

function monthGrid(u: Ui, x: number, y: number, w: number, cell: number) {
  const cw = w / 7;
  DAYS.forEach((d, i) =>
    u.text(x + i * cw, y, cw, 20, d, { size: 12, bold: true, color: WF.muted, align: 'center' }),
  );
  for (let day = 1; day <= 31; day += 1) {
    const at = FIRST + day - 1;
    const cx = x + (at % 7) * cw + cw / 2;
    const cy = y + 28 + Math.floor(at / 7) * cell + cell / 2 - 4;
    const today = day === TODAY;
    if (today)
      u.els.push(
        u.k.shape('circle', cx - 18, cy - 18, 36, 36, {
          label: '',
          fillColor: WF.ink,
          strokeWidth: 'none',
        }),
      );
    u.text(cx - 18, cy - 18, 36, 36, String(day), {
      size: 15,
      bold: today,
      color: today ? WF.white : WF.ink,
      align: 'center',
    });
    if (BUSY.has(day) && !today)
      u.els.push(
        u.k.shape('circle', cx - 2.5, cy + 14, 5, 5, {
          label: '',
          fillColor: WF.muted,
          strokeWidth: 'none',
        }),
      );
  }
  return y + 28 + 5 * cell;
}

function eventRow(u: Ui, x: number, y: number, w: number, i: number) {
  const [title, time, now] = EVENTS[i % EVENTS.length]!;
  u.card(x, y, w, 60);
  u.block(x + 12, y + 12, 4, 36, { fillColor: now ? WF.ink : WF.line, borderRadius: 'full' });
  u.text(x + 28, y + 10, w - 40, 22, title, { size: 15, bold: true, color: WF.ink });
  u.text(x + 28, y + 32, w - 40, 18, time, { size: 13, color: WF.muted });
}

export const calendar = responsive(
  (u) => {
    const { W, H } = u;
    let y = topBar(u, 'October', { action: 'plus' });
    y = monthGrid(u, 0, y, W, 44) + 12;
    u.text(0, y, W, 24, 'Today', { size: 17, bold: true, color: WF.ink });
    y += 34;
    for (let i = 0; y + 60 <= H - 64; i += 1) {
      eventRow(u, 0, y, W, i);
      y += 70;
    }
    tabBar(u, [
      ['calendar', 'Calendar'],
      ['check-circle', 'Tasks'],
      ['bell', 'Inbox'],
      ['user', 'Profile'],
    ]);
  },
  (u) => {
    const { W, H } = u;
    u.heading(0, 0, 360, 'October 2026', 30);
    u.chip(W - 380, 4, 'Day', false, 36);
    u.chip(W - 316, 4, 'Week', false, 36);
    u.chip(W - 244, 4, 'Month', true, 36);
    u.button(W - 160, 2, 160, 40, 'New Event');
    const gw = Math.round(W * 0.56);
    u.card(0, 64, gw, H - 64);
    monthGrid(u, 16, 84, gw - 32, Math.min(76, (H - 140) / 5));
    const x = gw + 24;
    const w = W - x;
    u.text(x, 64, w, 26, 'Monday, 19 October', { size: 18, bold: true, color: WF.ink });
    const hours = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
    const top = 108;
    const pitch = Math.min(64, (H - top) / hours.length);
    hours.forEach((h, i) => {
      const hy = top + i * pitch;
      u.text(x, hy - 9, 52, 18, h, { size: 12, color: WF.muted });
      u.divider(x + 60, hy, w - 60);
    });
    const slot = (i: number, from: number, len: number) => {
      const [title, time, now] = EVENTS[i]!;
      const ey = top + from * pitch + 3;
      u.block(x + 68, ey, w - 76, len * pitch - 6, {
        fillColor: now ? WF.ink : WF.soft,
        borderRadius: 'md',
      });
      u.text(x + 80, ey + 6, w - 100, 20, title, {
        size: 14,
        bold: true,
        color: now ? WF.white : WF.ink,
      });
      u.text(x + 80, ey + 26, w - 100, 18, time, { size: 12, color: now ? WF.line : WF.muted });
    };
    slot(0, 1, 1);
    slot(1, 3.5, 1);
    slot(2, 6, 1);
  },
  { column: 'full' },
);

// ---- Inbox ------------------------------------------------------------------------------------

const MAIL: readonly [string, string, string, string, boolean][] = [
  [
    'Priya Patel',
    'Launch checklist',
    'Here is the final list for Thursday, two items left…',
    '9:41',
    true,
  ],
  ['GitHub', 'Your weekly digest', 'Six pull requests merged, two reviews waiting…', '9:12', true],
  [
    'Sam Rivera',
    'Re: Offsite dates',
    'Either week works for me, the second is easier…',
    'Yesterday',
    false,
  ],
  [
    'Alex Morgan',
    'Photos from the trip',
    'Uploaded the album, have a look when you can…',
    'Yesterday',
    false,
  ],
  ['Mia Novak', 'Invoice #2041', 'Attached is the invoice for September’s work…', 'Mon', false],
  ['Chris Wong', 'Quick question', 'Do you have five minutes later today to talk…', 'Mon', false],
  [
    'Leo Grant',
    'Coffee next week?',
    'I’m in town Tuesday and Wednesday if you’re free…',
    'Sun',
    false,
  ],
];

function mailRow(u: Ui, x: number, y: number, w: number, i: number, chosen = false) {
  const [from, subject, preview, time, unread] = MAIL[i % MAIL.length]!;
  if (chosen) u.block(x, y, w, 76, { fillColor: WF.soft, borderRadius: 'md' });
  if (unread)
    u.els.push(
      u.k.shape('circle', x + 4, y + 18, 8, 8, {
        label: '',
        fillColor: WF.ink,
        strokeWidth: 'none',
      }),
    );
  u.avatar(x + 18, y + 12, 40);
  const tx = x + 70;
  u.text(tx, y + 8, w - 150, 20, from, { size: 15, bold: unread, color: WF.ink });
  u.text(x + w - 80, y + 8, 72, 20, time, { size: 12, color: WF.muted, align: 'right' });
  u.text(tx, y + 28, w - 80, 20, subject, { size: 14, bold: unread, color: WF.body });
  // One line of preview, cut to what fits (a glyph about 0.55 of its size).
  const fits = Math.max(8, Math.floor((w - 80) / (13 * 0.55)));
  const line = preview.length > fits ? `${preview.slice(0, fits - 1).trimEnd()}…` : preview;
  u.text(tx, y + 48, w - 80, 18, line, { size: 13, color: WF.muted });
}

export const inbox = responsive(
  (u) => {
    const { W, H } = u;
    let y = topBar(u, 'Inbox', { action: 'edit' });
    u.field(0, y, W, 44, 'Search mail', 'search');
    y += 60;
    for (let i = 0; y + 76 <= H - 64; i += 1) {
      mailRow(u, 0, y, W, i);
      u.divider(70, y + 80, W - 70);
      y += 84;
    }
    tabBar(u, [
      ['mail', 'Mail'],
      ['star', 'Starred'],
      ['send', 'Sent'],
      ['settings', 'Settings'],
    ]);
  },
  (u) => {
    const { W, H } = u;
    const side = sideNav(
      u,
      [
        ['mail', 'Inbox'],
        ['star', 'Starred'],
        ['send', 'Sent'],
        ['file-text', 'Drafts'],
        ['archive', 'Archive'],
      ],
      0,
      200,
    );
    const lx = side + 20;
    const lw = Math.min(380, Math.round((W - lx) * 0.42));
    u.field(lx, 0, lw, 44, 'Search mail', 'search');
    let y = 60;
    for (let i = 0; y + 76 <= H; i += 1) {
      mailRow(u, lx, y, lw, i, i === 0);
      y += 84;
    }
    const x = lx + lw + 28;
    const w = W - x;
    u.block(x - 14, 0, 1, H, { fillColor: WF.line, borderRadius: 'none' });
    u.text(x, 0, w - 120, 36, 'Launch checklist', { size: 24, bold: true, color: WF.ink });
    u.icon(W - 64, 6, 22, 'archive', WF.body);
    u.icon(W - 28, 6, 22, 'trash', WF.body);
    u.avatar(x, 56, 44);
    u.text(x + 56, 56, w - 160, 22, 'Priya Patel', { size: 15, bold: true, color: WF.ink });
    u.text(x + 56, 78, w - 160, 20, 'to me', { size: 13, color: WF.muted });
    u.text(W - 100, 56, 100, 22, '9:41', { size: 13, color: WF.muted, align: 'right' });
    let by = u.lines(x, 128, w, 4) + 16;
    by = u.lines(x, by, w, 3) + 16;
    u.card(x, by, Math.min(260, w), 60);
    u.icon(x + 16, by + 18, 24, 'paperclip', WF.body);
    u.text(x + 52, by + 10, 200, 20, 'checklist.pdf', { size: 14, bold: true, color: WF.ink });
    u.text(x + 52, by + 30, 200, 18, '240 KB', { size: 12, color: WF.muted });
    u.button(x, Math.min(H - 48, by + 88), 120, 44, 'Reply');
    u.button(x + 132, Math.min(H - 48, by + 88), 120, 44, 'Forward', 'secondary');
  },
  { column: 'full' },
);

// ---- Notifications ----------------------------------------------------------------------------

const ALERTS: readonly [string, string, string, boolean][] = [
  ['Sam Rivera', 'liked your photo.', '2m', true],
  ['Priya Patel', 'mentioned you in Launch plan.', '18m', true],
  ['Alex Morgan', 'started following you.', '1h', false],
  ['Mia Novak', 'commented: “Looks great!”', '3h', false],
  ['Chris Wong', 'shared a file with you.', 'Yesterday', false],
  ['Leo Grant', 'invited you to Offsite.', 'Yesterday', false],
  ['Ava Brooks', 'replied to your comment.', 'Mon', false],
];

function alertRow(u: Ui, x: number, y: number, w: number, i: number) {
  const [who, what, when, unread] = ALERTS[i % ALERTS.length]!;
  u.avatar(x, y + 4, 44);
  u.text(x + 56, y + 2, w - 130, 22, who, { size: 15, bold: true, color: WF.ink });
  u.text(x + 56, y + 24, w - 130, 22, what, { size: 14, color: WF.body });
  u.text(x + w - 80, y + 4, 64, 18, when, { size: 12, color: WF.muted, align: 'right' });
  if (unread)
    u.els.push(
      u.k.shape('circle', x + w - 10, y + 30, 10, 10, {
        label: '',
        fillColor: WF.ink,
        strokeWidth: 'none',
      }),
    );
}

function alertList(u: Ui, x: number, y: number, w: number, bottom: number) {
  u.chip(x, y, 'All', true);
  u.chip(x + 62, y, 'Mentions');
  u.chip(x + 168, y, 'Follows');
  y += 56;
  u.text(x, y, w, 20, 'TODAY', { size: 12, bold: true, color: WF.muted });
  y += 30;
  for (let i = 0; y + 56 <= bottom; i += 1) {
    if (i === 2) {
      u.text(x, y + 4, w, 20, 'EARLIER', { size: 12, bold: true, color: WF.muted });
      y += 34;
      if (y + 56 > bottom) break;
    }
    alertRow(u, x, y, w, i);
    y += 68;
  }
}

export const notifications = responsive(
  (u) => {
    alertList(u, 0, topBar(u, 'Notifications', { action: 'settings' }), u.W, u.H - 64);
    tabBar(u);
  },
  (u) => {
    const top = topNav(u, ['Home', 'Explore', 'Messages'], 'avatar');
    const w = Math.min(720, u.W);
    const x = (u.W - w) / 2;
    u.heading(x, top, w, 'Notifications', 30);
    u.text(x + w - 160, top + 6, 160, 24, 'Mark all as read', {
      size: 14,
      bold: true,
      color: WF.ink,
      align: 'right',
    });
    alertList(u, x, top + 60, w, u.H);
  },
  { column: 'full' },
);

// ---- Article ----------------------------------------------------------------------------------

function articleBody(u: Ui, x: number, y: number, w: number, bottom: number, big: boolean) {
  u.chip(x, y, 'Design', false, 30);
  y += 44;
  const size = big ? 40 : 26;
  const title = 'How Small Teams Ship Faster Without Burning Out';
  // As many lines as the title takes at this width (a bold glyph’s advance up to 0.64 of its size).
  const lines = Math.ceil((title.length * size * 0.64) / w);
  const th = Math.ceil(lines * size * 1.3);
  u.text(x, y, w, th, title, { size, bold: true, color: WF.ink, alignY: 'top' });
  y += th + 12;
  u.avatar(x, y, 40);
  u.text(x + 52, y, w - 52, 20, 'Jordan Lee', { size: 14, bold: true, color: WF.ink });
  u.text(x + 52, y + 20, w - 52, 20, '6 min read · 19 Oct 2026', { size: 13, color: WF.muted });
  y += 60;
  const pic = Math.round(Math.min(w * 0.56, 320));
  if (y + pic < bottom) {
    u.picture(x, y, w, pic);
    y += pic + 24;
  }
  while (y + 80 <= bottom) {
    y = u.lines(x, y, w, 4, 20) + 18;
  }
}

export const article = responsive(
  (u) => {
    u.icon(0, 8, 24, 'arrow-left', WF.ink);
    u.icon(u.W - 64, 8, 24, 'bookmark', WF.ink);
    u.icon(u.W - 26, 8, 24, 'share', WF.ink);
    articleBody(u, 0, 56, u.W, u.H, false);
  },
  (u) => {
    const top = topNav(u, ['Stories', 'Topics', 'About'], 'avatar');
    const rail = u.W >= 1100 ? 300 : 0;
    const w = Math.min(720, u.W - rail - (rail ? 48 : 0));
    const x = rail ? Math.max(0, (u.W - rail - 48 - w) / 2) : (u.W - w) / 2;
    articleBody(u, x, top, w, u.H, true);
    if (!rail) return;
    const rx = u.W - rail;
    u.text(rx, top, rail, 24, 'More Stories', { size: 16, bold: true, color: WF.ink });
    ['Writing Briefs People Read', 'The Five Minute Standup', 'Design Reviews That Work'].forEach(
      (t, i) => {
        const y = top + 40 + i * 104;
        if (y + 88 > u.H) return;
        u.picture(rx, y, 88, 88, 'md');
        u.text(rx + 104, y + 4, rail - 104, 44, t, {
          size: 15,
          bold: true,
          color: WF.ink,
          alignY: 'top',
        });
        u.text(rx + 104, y + 56, rail - 104, 18, '4 min read', { size: 12, color: WF.muted });
      },
    );
  },
);

// ---- Places -----------------------------------------------------------------------------------

// A map: a soft ground, roads as pale bands, and pins.
function mapArea(u: Ui, x: number, y: number, w: number, h: number, pins: number) {
  u.block(x, y, w, h, { fillColor: WF.soft, borderRadius: 'lg' });
  u.block(x, y + h * 0.38, w, 14, { fillColor: WF.white, borderRadius: 'none' });
  u.block(x + w * 0.62, y, 14, h, { fillColor: WF.white, borderRadius: 'none' });
  u.block(x, y + h * 0.74, w, 10, { fillColor: WF.white, borderRadius: 'none' });
  u.block(x + w * 0.22, y, 10, h, { fillColor: WF.white, borderRadius: 'none' });
  u.block(x + w * 0.3, y + h * 0.08, w * 0.24, h * 0.22, {
    fillColor: WF.place,
    borderRadius: 'md',
  });
  const spots = [
    [0.45, 0.3],
    [0.7, 0.55],
    [0.3, 0.62],
    [0.82, 0.22],
    [0.55, 0.82],
  ];
  spots.slice(0, pins).forEach(([px, py], i) => {
    const cx = x + w * px!;
    const cy = y + h * py!;
    u.els.push(
      u.k.shape('circle', cx - 18, cy - 18, 36, 36, {
        label: '',
        fillColor: i === 0 ? WF.ink : WF.white,
        strokeColor: WF.ink,
        strokeWidth: 'thin',
      }),
    );
    u.icon(cx - 10, cy - 10, 20, 'map-pin', i === 0 ? WF.white : WF.ink);
  });
}

function placeCard(u: Ui, x: number, y: number, w: number) {
  u.text(x, y, w, 26, 'Corner Coffee', { size: 20, bold: true, color: WF.ink });
  u.text(x, y + 28, w, 20, '★ 4.7 · Café · 0.3 mi · Open until 6 pm', {
    size: 13,
    color: WF.muted,
  });
  let cx = x;
  ['Wi-Fi', 'Outdoor', 'Vegan'].forEach((c) => {
    cx += u.chip(cx, y + 60, c, false, 30) + 8;
  });
  const half = (w - 12) / 2;
  u.button(x, y + 108, half, 48, 'Directions');
  u.button(x + half + 12, y + 108, half, 48, 'Call', 'secondary');
}

export const places = responsive(
  (u) => {
    const { W, H } = u;
    mapArea(u, -16, -8, W + 32, H - 220, 4);
    u.field(0, 8, W, 48, 'Search places', 'search');
    const sheet = H - 236;
    u.block(-16, sheet, W + 32, 236 + 16, {
      fillColor: WF.white,
      strokeColor: WF.line,
      strokeWidth: 'thin',
      borderRadius: 'lg',
    });
    u.block(W / 2 - 20, sheet + 10, 40, 5, { fillColor: WF.line, borderRadius: 'full' });
    placeCard(u, 0, sheet + 32, W);
  },
  (u) => {
    const { W, H } = u;
    const lw = Math.min(380, Math.round(W * 0.34));
    u.field(0, 0, lw, 48, 'Coffee near me', 'search');
    u.text(0, 64, lw, 20, '12 places', { size: 13, color: WF.muted });
    [
      'Corner Coffee',
      'Bean There',
      'The Daily Grind',
      'Roast & Co',
      'Little Cup',
      'North Brew',
    ].forEach((n, i) => {
      const y = 96 + i * 92;
      if (y + 80 > H) return;
      if (i === 0) u.block(-8, y - 8, lw + 16, 92, { fillColor: WF.soft, borderRadius: 'lg' });
      u.picture(0, y, 76, 76, 'md');
      u.text(92, y + 4, lw - 92, 22, n, { size: 16, bold: true, color: WF.ink });
      u.text(92, y + 28, lw - 92, 18, `★ 4.${7 - i} · Café · 0.${i + 3} mi`, {
        size: 13,
        color: WF.muted,
      });
      u.text(92, y + 50, lw - 92, 18, 'Open until 6 pm', { size: 13, color: WF.body });
    });
    const mx = lw + 24;
    mapArea(u, mx, 0, W - mx, H, 5);
    const cw = Math.min(360, W - mx - 48);
    u.card(mx + 24, H - 196, cw, 172);
    placeCard(u, mx + 44, H - 180, cw - 40);
  },
);

// ---- Music player -----------------------------------------------------------------------------

function scrubber(u: Ui, x: number, y: number, w: number) {
  u.block(x, y, w, 4, { fillColor: WF.line, borderRadius: 'full' });
  u.block(x, y, w * 0.38, 4, { fillColor: WF.ink, borderRadius: 'full' });
  u.els.push(
    u.k.shape('circle', x + w * 0.38 - 7, y - 5, 14, 14, {
      label: '',
      fillColor: WF.ink,
      strokeWidth: 'none',
    }),
  );
  u.text(x, y + 12, 60, 18, '1:24', { size: 12, color: WF.muted });
  u.text(x + w - 60, y + 12, 60, 18, '3:41', { size: 12, color: WF.muted, align: 'right' });
}

function controls(u: Ui, cx: number, y: number, d: number) {
  u.els.push(
    u.k.shape('circle', cx - d / 2, y, d, d, { label: '', fillColor: WF.ink, strokeWidth: 'none' }),
  );
  playMark(u, cx, y + d / 2, d * 0.36, WF.white);
  // Previous and next: a bar beside a triangle.
  const side = (dir: -1 | 1) => {
    const sx = cx + dir * d * 1.3;
    const t = d * 0.32;
    u.els.push(
      u.k.shape('triangle', sx - t / 2, y + d / 2 - t / 2, t, t, {
        label: '',
        rotation: dir * 90,
        fillColor: WF.ink,
        strokeColor: WF.ink,
        strokeWidth: 'none',
      }),
    );
    u.block(sx + dir * (t / 2) - (dir > 0 ? 0 : 3), y + d / 2 - t / 2, 3, t, {
      fillColor: WF.ink,
      borderRadius: 'none',
    });
  };
  side(-1);
  side(1);
}

const TRACKS: readonly [string, string][] = [
  ['Morning Light', '3:41'],
  ['Slow Rivers', '4:02'],
  ['Paper Planes', '2:58'],
  ['Neon Hours', '3:27'],
  ['Weekend', '3:15'],
  ['Last Train Home', '4:44'],
  ['Open Roads', '3:09'],
  ['Afterglow', '3:52'],
];

export const musicPlayer = responsive(
  (u) => {
    const { W, H } = u;
    topBar(u, 'Now Playing', { back: true, action: 'more-horizontal' });
    const art = Math.min(W, H - 340);
    u.picture((W - art) / 2, 64, art, art);
    let y = 64 + art + 24;
    u.text(0, y, W - 40, 28, 'Morning Light', { size: 22, bold: true, color: WF.ink });
    u.icon(W - 26, y + 2, 24, 'heart', WF.ink);
    u.text(0, y + 30, W, 22, 'The Quiet Hours', { size: 15, color: WF.muted });
    y += 76;
    scrubber(u, 0, y, W);
    controls(u, W / 2, y + 48, 68);
    u.icon(0, y + 70, 22, 'headphones', WF.muted);
    u.icon(W - 22, y + 70, 22, 'share', WF.muted);
  },
  (u) => {
    const { W, H } = u;
    const side = sideNav(
      u,
      [
        ['home', 'Home'],
        ['search', 'Search'],
        ['music', 'Library'],
        ['heart', 'Liked Songs'],
      ],
      0,
      220,
    );
    const x = side + 32;
    const w = W - x;
    const bar = 88;
    const art = Math.min(220, H - bar - 160);
    u.picture(x, 0, art, art);
    u.text(x + art + 28, art - 120, w - art - 28, 20, 'ALBUM', {
      size: 12,
      bold: true,
      color: WF.muted,
    });
    u.text(x + art + 28, art - 98, w - art - 28, 44, 'The Quiet Hours', {
      size: 34,
      bold: true,
      color: WF.ink,
    });
    u.text(x + art + 28, art - 48, w - art - 28, 20, 'Lumen · 2026 · 12 songs', {
      size: 14,
      color: WF.muted,
    });
    u.button(x + art + 28, art - 10 - 14, 112, 40, 'Play');
    let y = art + 32;
    TRACKS.forEach(([t, d], i) => {
      if (y + 44 > H - bar - 12) return;
      if (i === 0) u.block(x - 8, y, w + 8, 44, { fillColor: WF.soft, borderRadius: 'md' });
      u.text(x + 8, y, 32, 44, String(i + 1), { size: 14, color: WF.muted });
      u.text(x + 48, y, w - 160, 44, t, { size: 15, bold: i === 0, color: WF.ink });
      u.text(x + w - 80, y, 64, 44, d, { size: 14, color: WF.muted, align: 'right' });
      y += 48;
    });
    // The player along the foot.
    const by = H - bar;
    u.card(0, by, W, bar);
    u.picture(16, by + 16, 56, 56, 'md');
    u.text(88, by + 20, 220, 22, 'Morning Light', { size: 15, bold: true, color: WF.ink });
    u.text(88, by + 44, 220, 20, 'The Quiet Hours', { size: 13, color: WF.muted });
    controls(u, W / 2, by + 10, 40);
    scrubber(u, W / 2 - 180, by + 62, 360);
  },
  { column: 'full' },
);

// ---- Photo gallery ----------------------------------------------------------------------------

export const gallery = responsive(
  (u) => {
    const { W, H } = u;
    let y = topBar(u, 'Photos', { action: 'plus' });
    let cx = 0;
    ['All', 'Favourites', 'Albums', 'Videos'].forEach((c, i) => {
      cx += u.chip(cx, y, c, i === 0) + 8;
    });
    y += 52;
    u.text(0, y, W, 20, 'October 2026', { size: 14, bold: true, color: WF.ink });
    y += 30;
    const gap = 4;
    const s = (W - 2 * gap) / 3;
    for (let row = 0; y + s <= H - 60; row += 1) {
      for (let c = 0; c < 3; c += 1) u.picture(c * (s + gap), y, s, s, 'none');
      y += s + gap;
    }
    tabBar(u, [
      ['image', 'Library'],
      ['heart', 'For You'],
      ['folder', 'Albums'],
      ['search', 'Search'],
    ]);
  },
  (u) => {
    const { W, H } = u;
    const top = topNav(u, ['Library', 'Albums', 'Shared'], 'avatar');
    u.heading(0, top, 400, 'October 2026', 28);
    // The filters at the right, beside the heading.
    let x = W - 370;
    ['All', 'Favourites', 'Albums', 'Videos'].forEach((c, i) => {
      x += u.chip(x, top + 2, c, i === 0) + 8;
    });
    // A masonry of pictures in columns, each its own heights.
    const cols = W >= 1200 ? 5 : W >= 900 ? 4 : 3;
    const gap = 12;
    const cw = (W - gap * (cols - 1)) / cols;
    const heights = [1.3, 0.8, 1.05, 0.9, 1.2, 0.75, 1.1];
    for (let c = 0; c < cols; c += 1) {
      let y = top + 64;
      for (let i = 0; ; i += 1) {
        const h = cw * heights[(c * 3 + i) % heights.length]!;
        if (y + h > H) break;
        u.picture(c * (cw + gap), y, cw, h, 'md');
        y += h + gap;
      }
    }
  },
);
