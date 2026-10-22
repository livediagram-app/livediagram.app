// Wireframe layouts, Work, Media and Account additions (docs/specs/007-editor/wireframe-pages.md
// "Wireframe layouts"): a kanban board and a task list, a video player and a podcast, editing a
// profile and a help centre. Each a phone column or a wider
// arrangement; pure builders over the safe area (wireframe-layout-kit).
import { sideNav, tabBar, topBar, topNav, WF, type Ui } from './wireframe-layout-kit';
import { responsive } from './wireframe-layouts-start';

// A play triangle (a triangle turned to point right), centred on (cx, cy).
function play(u: Ui, cx: number, cy: number, d: number, color: string) {
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

// ---- Work -------------------------------------------------------------------------------------

const COLUMNS: readonly [string, string[]][] = [
  ['To Do', ['Write launch email', 'Pick pricing', 'Book venue']],
  ['In Progress', ['Onboarding flow', 'Billing page']],
  ['Review', ['Landing copy']],
  ['Done', ['Brand colours', 'Domain', 'Beta invites']],
];

function taskCard(u: Ui, x: number, y: number, w: number, title: string, i: number) {
  u.card(x, y, w, 88);
  u.chip(x + 12, y + 10, ['Design', 'Eng', 'Ops'][i % 3]!, false, 24);
  u.text(x + 12, y + 40, w - 24, 22, title, { size: 14, bold: true, color: WF.ink });
  u.avatar(x + 12, y + 62, 20);
  u.text(x + w - 80, y + 62, 68, 20, ['Today', 'Fri', 'Oct 24'][i % 3]!, {
    size: 12,
    color: WF.muted,
    align: 'right',
  });
}

export const kanban = responsive(
  (u) => {
    const { W, H } = u;
    let y = topBar(u, 'Launch', { action: 'plus' });
    let cx = 0;
    COLUMNS.forEach(([name, cards], i) => {
      cx += u.chip(cx, y, `${name} ${cards.length}`, i === 1) + 6;
    });
    y += 52;
    for (const [i, title] of COLUMNS[1]![1].concat(COLUMNS[0]![1]).entries()) {
      if (y + 88 > H - 64) break;
      taskCard(u, 0, y, W, title, i);
      y += 100;
    }
    tabBar(u, [
      ['layers', 'Boards'],
      ['check-circle', 'My Tasks'],
      ['bell', 'Inbox'],
      ['user', 'Profile'],
    ]);
  },
  (u) => {
    const { W, H } = u;
    const side = sideNav(u, [
      ['layers', 'Boards'],
      ['check-circle', 'My Tasks'],
      ['calendar', 'Calendar'],
      ['users', 'Team'],
    ]);
    const x = side + 28;
    const w = W - x;
    u.heading(x, 0, 360, 'Launch Board', 28);
    u.button(W - 132, 0, 132, 40, 'New Task');
    const cols = w >= 900 ? 4 : 3;
    const gap = 16;
    const cw = (w - gap * (cols - 1)) / cols;
    COLUMNS.slice(0, cols).forEach(([name, cards], c) => {
      const cxp = x + c * (cw + gap);
      u.block(cxp, 60, cw, H - 60, { fillColor: WF.soft, borderRadius: 'lg' });
      u.text(cxp + 14, 72, cw - 28, 24, `${name}  ${cards.length}`, {
        size: 14,
        bold: true,
        color: WF.ink,
      });
      cards.forEach((t, i) => {
        const y = 108 + i * 100;
        if (y + 88 <= H - 8) taskCard(u, cxp + 10, y, cw - 20, t, i + c);
      });
    });
  },
);

const TASKS: readonly [string, string, boolean][] = [
  ['Send the launch email draft', 'Today', true],
  ['Review the billing page', 'Today', false],
  ['Call the venue about Friday', 'Tomorrow', false],
  ['Pick the pricing tiers', 'Fri', false],
  ['Write the help article', 'Mon', false],
  ['Thank the beta testers', 'Mon', false],
  ['Plan the retro', 'Next week', false],
];

function taskRow(u: Ui, x: number, y: number, w: number, i: number) {
  const [title, due, done] = TASKS[i % TASKS.length]!;
  u.els.push(
    u.k.shape('circle', x, y + 12, 24, 24, {
      label: '',
      fillColor: done ? WF.ink : WF.white,
      strokeColor: done ? WF.ink : WF.line,
      strokeWidth: done ? 'none' : 'medium',
    }),
  );
  if (done) u.icon(x + 5, y + 17, 14, 'check', WF.white);
  u.text(x + 40, y + 6, w - 140, 22, title, { size: 15, color: done ? WF.muted : WF.ink });
  u.text(x + 40, y + 28, w - 140, 18, due, { size: 12, color: WF.muted });
  u.icon(x + w - 22, y + 14, 20, 'flag', i === 1 ? WF.ink : WF.line);
}

export const taskList = responsive(
  (u) => {
    const { W, H } = u;
    let y = topBar(u, 'My Tasks', { action: 'plus' });
    u.text(0, y, W, 20, 'TODAY · 2 LEFT', { size: 12, bold: true, color: WF.muted });
    y += 28;
    for (let i = 0; y + 52 <= H - 128; i += 1) {
      taskRow(u, 0, y, W, i);
      u.divider(40, y + 54, W - 40);
      y += 60;
    }
    u.field(0, H - 116, W, 48, 'Add a task', 'plus');
    tabBar(u, [
      ['check-circle', 'Tasks'],
      ['calendar', 'Upcoming'],
      ['flag', 'Flagged'],
      ['settings', 'Settings'],
    ]);
  },
  (u) => {
    const { W, H } = u;
    const side = sideNav(u, [
      ['check-circle', 'Today'],
      ['calendar', 'Upcoming'],
      ['flag', 'Flagged'],
      ['archive', 'Done'],
    ]);
    const x = side + 40;
    const w = Math.min(760, W - x);
    u.heading(x, 0, w, 'Today', 30);
    u.text(x, 42, w, 22, 'Monday, 19 October · 2 left', { size: 15, color: WF.muted });
    let y = 88;
    for (let i = 0; y + 52 <= H - 72; i += 1) {
      taskRow(u, x, y, w, i);
      u.divider(x + 40, y + 54, w - 40);
      y += 60;
    }
    u.field(x, H - 52, w, 52, 'Add a task', 'plus');
  },
);

// ---- Media ------------------------------------------------------------------------------------

function videoFrame(u: Ui, x: number, y: number, w: number, h: number) {
  u.block(x, y, w, h, { fillColor: WF.ink, borderRadius: 'md' });
  u.els.push(
    u.k.shape('circle', x + w / 2 - 28, y + h / 2 - 28, 56, 56, {
      label: '',
      fillColor: WF.white,
      strokeWidth: 'none',
      opacity: 0.9,
    }),
  );
  play(u, x + w / 2, y + h / 2, 22, WF.ink);
  u.block(x + 12, y + h - 18, w - 24, 4, { fillColor: WF.body, borderRadius: 'full' });
  u.block(x + 12, y + h - 18, (w - 24) * 0.35, 4, { fillColor: WF.white, borderRadius: 'full' });
}

function videoMeta(u: Ui, x: number, y: number, w: number) {
  u.text(x, y, w, 26, 'Building a Wireframe in Ten Minutes', {
    size: 18,
    bold: true,
    color: WF.ink,
  });
  u.text(x, y + 28, w, 20, '48k views · 2 days ago', { size: 13, color: WF.muted });
  u.avatar(x, y + 60, 36);
  u.text(x + 48, y + 60, w - 160, 20, 'Design Weekly', { size: 14, bold: true, color: WF.ink });
  u.text(x + 48, y + 78, w - 160, 18, '120k subscribers', { size: 12, color: WF.muted });
  u.button(x + w - 104, y + 62, 104, 34, 'Subscribe');
}

function upNext(u: Ui, x: number, y: number, w: number, bottom: number) {
  [
    'Grids Without the Maths',
    'Ten Buttons, Ranked',
    'Colour for Wireframes',
    'Type That Reads',
  ].forEach((t, i) => {
    const ry = y + i * 92;
    if (ry + 80 > bottom) return;
    u.picture(x, ry, 140, 80, 'md');
    u.text(x + 152, ry + 2, w - 152, 40, t, { size: 14, bold: true, color: WF.ink, alignY: 'top' });
    u.text(x + 152, ry + 44, w - 152, 18, `Design Weekly · ${12 + i * 7}k views`, {
      size: 12,
      color: WF.muted,
    });
  });
}

export const videoPlayer = responsive(
  (u) => {
    const { W, H } = u;
    const vh = Math.round(((W + 32) * 9) / 16);
    videoFrame(u, -16, 0, W + 32, vh);
    videoMeta(u, 0, vh + 16, W);
    u.text(0, vh + 132, W, 22, 'Up Next', { size: 15, bold: true, color: WF.ink });
    upNext(u, 0, vh + 164, W, H);
  },
  (u) => {
    const { W, H } = u;
    const top = topNav(u, ['Home', 'Subscriptions', 'Library'], 'avatar');
    const rail = W >= 1000 ? 360 : 0;
    const vw = W - rail - (rail ? 32 : 0);
    const vh = Math.min(Math.round((vw * 9) / 16), H - top - 120);
    videoFrame(u, 0, top, vw, vh);
    videoMeta(u, 0, top + vh + 16, vw);
    if (rail) upNext(u, vw + 32, top, rail, H);
  },
);

const EPISODES: readonly [string, string][] = [
  ['142 · Designing in the Open', '48 min'],
  ['141 · The Quiet Launch', '52 min'],
  ['140 · Tools We Stopped Using', '39 min'],
  ['139 · Hiring Your First Designer', '61 min'],
  ['138 · Saying No to Features', '44 min'],
];

function episodeRow(u: Ui, x: number, y: number, w: number, i: number) {
  const [title, len] = EPISODES[i % EPISODES.length]!;
  u.text(x, y, w - 60, 22, title, { size: 15, bold: true, color: WF.ink });
  u.text(x, y + 22, w - 60, 18, `Oct ${19 - i * 7} · ${len}`, { size: 12, color: WF.muted });
  u.els.push(
    u.k.shape('circle', x + w - 40, y + 2, 36, 36, {
      label: '',
      fillColor: WF.white,
      strokeColor: WF.line,
      strokeWidth: 'thin',
    }),
  );
  play(u, x + w - 22, y + 20, 12, WF.ink);
}

export const podcast = responsive(
  (u) => {
    const { W, H } = u;
    let y = topBar(u, '', { back: true, action: 'share' });
    u.picture((W - 180) / 2, y, 180, 180, 'lg');
    u.text(0, y + 196, W, 28, 'Small Studio Show', {
      size: 22,
      bold: true,
      color: WF.ink,
      align: 'center',
    });
    u.text(0, y + 226, W, 20, 'Jordan Lee & Sam Rivera', {
      size: 14,
      color: WF.muted,
      align: 'center',
    });
    u.button((W - 220) / 2, y + 260, 106, 40, 'Follow');
    u.button(W / 2 + 4, y + 260, 106, 40, 'Play', 'secondary');
    y += 324;
    for (let i = 0; y + 44 <= H; i += 1) {
      episodeRow(u, 0, y, W, i);
      u.divider(0, y + 52, W);
      y += 64;
    }
  },
  (u) => {
    const { W, H } = u;
    const top = topNav(u, ['Browse', 'Library', 'Search'], 'avatar');
    const art = Math.min(240, H - top - 40);
    u.picture(0, top, art, art, 'lg');
    const x = art + 36;
    u.text(x, top + 8, W - x, 20, 'PODCAST · DESIGN', { size: 12, bold: true, color: WF.muted });
    u.text(x, top + 32, W - x, 44, 'Small Studio Show', { size: 34, bold: true, color: WF.ink });
    u.text(x, top + 80, W - x, 20, 'Jordan Lee & Sam Rivera · Weekly', {
      size: 15,
      color: WF.muted,
    });
    u.lines(x, top + 116, Math.min(560, W - x), 2);
    u.button(x, top + art - 44, 120, 44, 'Follow');
    u.button(x + 132, top + art - 44, 120, 44, 'Latest', 'secondary');
    let y = top + art + 32;
    for (let i = 0; y + 44 <= H; i += 1) {
      episodeRow(u, 0, y, W, i);
      u.divider(0, y + 52, W);
      y += 64;
    }
  },
);

// ---- Account ----------------------------------------------------------------------------------

function profileForm(u: Ui, x: number, y: number, w: number) {
  y = u.labelled(x, y, w, 'Name', 'Jordan Lee') + 14;
  y = u.labelled(x, y, w, 'Username', '@jordan') + 14;
  u.text(x, y, w, 20, 'Bio', { size: 13, bold: true, color: WF.body });
  u.block(x, y + 24, w, 96, {
    label: 'Product designer, plant person, weekend climber.',
    textSize: 15,
    textColor: WF.muted,
    textAlignX: 'left',
    textAlignY: 'top',
    padding: 'md',
    fillColor: WF.white,
    strokeColor: WF.line,
    strokeWidth: 'thin',
  });
  y += 136;
  return u.labelled(x, y, w, 'Website', 'jordan.design') + 14;
}

export const editProfile = responsive(
  (u) => {
    const { W, H } = u;
    u.text(0, 4, 80, 32, 'Cancel', { size: 16, color: WF.body });
    u.text(0, 4, W, 32, 'Edit Profile', { size: 17, bold: true, color: WF.ink, align: 'center' });
    u.text(W - 60, 4, 60, 32, 'Save', { size: 16, bold: true, color: WF.ink, align: 'right' });
    u.avatar((W - 88) / 2, 56, 88);
    u.text(0, 152, W, 22, 'Change Photo', { size: 14, bold: true, color: WF.ink, align: 'center' });
    const y = profileForm(u, 0, 196, W);
    if (y + 44 < H) u.button(0, H - 48, W, 48, 'Delete Account', 'ghost');
  },
  (u) => {
    const { W } = u;
    const top = topNav(u, ['Home', 'Projects', 'Team'], 'avatar');
    const side = sideNav(
      u,
      [
        ['user', 'Profile'],
        ['lock', 'Security'],
        ['bell', 'Notifications'],
        ['credit-card', 'Billing'],
      ],
      top,
    );
    const x = side + 48;
    const w = Math.min(560, W - x - 200);
    u.heading(x, top, w, 'Profile', 28);
    profileForm(u, x, top + 60, w);
    const ax = x + w + 48;
    u.avatar(ax, top + 60, 120);
    u.button(ax, top + 196, 120, 40, 'Upload', 'secondary');
    u.button(x, top + 520, 140, 44, 'Save Changes');
  },
);

const FAQ: readonly [string, boolean][] = [
  ['How do I reset my password?', true],
  ['Can I change my plan later?', false],
  ['Where do I find my invoices?', false],
  ['How do I invite my team?', false],
  ['Is my data backed up?', false],
];

function faqList(u: Ui, x: number, y: number, w: number, bottom: number) {
  for (const [q, open] of FAQ) {
    const h = open ? 112 : 56;
    if (y + h > bottom) break;
    u.card(x, y, w, h);
    u.text(x + 16, y, w - 60, 56, q, { size: 15, bold: true, color: WF.ink });
    u.text(x + w - 36, y, 20, 56, open ? '−' : '+', { size: 20, color: WF.ink, align: 'center' });
    if (open) u.lines(x + 16, y + 60, w - 32, 2);
    y += h + 10;
  }
  return y;
}

export const helpCenter = responsive(
  (u) => {
    const { W, H } = u;
    let y = topBar(u, 'Help', { back: true });
    u.field(0, y, W, 48, 'Search for answers', 'search');
    y += 68;
    const half = (W - 12) / 2;
    [
      ['credit-card', 'Billing'],
      ['user', 'Account'],
      ['lock', 'Security'],
      ['users', 'Teams'],
    ].forEach(([iconId, label], i) => {
      const tx = (i % 2) * (half + 12);
      const ty = y + Math.floor(i / 2) * 84;
      u.card(tx, ty, half, 72);
      u.icon(tx + 14, ty + 14, 22, iconId!, WF.ink);
      u.text(tx + 14, ty + 42, half - 28, 20, label!, { size: 14, bold: true, color: WF.ink });
    });
    y += 180;
    u.text(0, y, W, 22, 'Popular Questions', { size: 16, bold: true, color: WF.ink });
    faqList(u, 0, y + 34, W, H - 60);
    u.button(0, H - 48, W, 48, 'Contact Support', 'secondary');
  },
  (u) => {
    const { W, H } = u;
    const top = topNav(u, ['Docs', 'Community', 'Status'], 'button');
    u.block(0, top, W, 180, { fillColor: WF.soft, borderRadius: 'lg' });
    u.text(0, top + 36, W, 40, 'How Can We Help?', {
      size: 32,
      bold: true,
      color: WF.ink,
      align: 'center',
    });
    const fw = Math.min(560, W - 64);
    u.field((W - fw) / 2, top + 96, fw, 52, 'Search for answers', 'search');
    const w = Math.min(760, W);
    faqList(u, (W - w) / 2, top + 212, w, H);
  },
);
