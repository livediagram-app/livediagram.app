// Wireframe layouts, Marketing and Travel (docs/specs/007-editor/wireframe-pages.md "Wireframe
// layouts"): a team page, a contact form and a blog, a flight search, a boarding pass and a ride.
// Each a phone column or a wider arrangement; pure builders over the safe area
// (wireframe-layout-kit).
import { tabBar, topBar, topNav, WF, type Ui } from './wireframe-layout-kit';
import { responsive } from './wireframe-layouts-start';

// ---- Marketing --------------------------------------------------------------------------------

const TEAM: readonly [string, string][] = [
  ['Jordan Lee', 'Founder'],
  ['Priya Patel', 'Engineering'],
  ['Sam Rivera', 'Design'],
  ['Alex Morgan', 'Product'],
  ['Mia Novak', 'Support'],
  ['Chris Wong', 'Growth'],
  ['Leo Grant', 'Engineering'],
  ['Ava Brooks', 'Design'],
];

function person(u: Ui, x: number, y: number, w: number, i: number) {
  const [name, role] = TEAM[i % TEAM.length]!;
  const d = Math.min(96, w - 16);
  u.avatar(x + (w - d) / 2, y, d);
  u.text(x, y + d + 10, w, 22, name, { size: 15, bold: true, color: WF.ink, align: 'center' });
  u.text(x, y + d + 32, w, 20, role, { size: 13, color: WF.muted, align: 'center' });
  return d + 64;
}

export const team = responsive(
  (u) => {
    const { W, H } = u;
    let y = topBar(u, 'Our Team', { back: true });
    u.text(0, y, W, 44, 'Twelve people building calm tools for busy teams.', {
      size: 15,
      color: WF.muted,
      alignY: 'top',
    });
    y += 60;
    const cw = (W - 16) / 2;
    for (let i = 0; ; i += 2) {
      const h = person(u, 0, y, cw, i);
      if (y + 2 * h > H) break;
      person(u, cw + 16, y, cw, i + 1);
      y += h + 12;
    }
  },
  (u) => {
    const { W, H } = u;
    const top = topNav(u);
    u.text(0, top + 8, W, 48, 'Meet the Team', {
      size: 40,
      bold: true,
      color: WF.ink,
      align: 'center',
    });
    u.text(0, top + 62, W, 24, 'Twelve people building calm tools for busy teams.', {
      size: 17,
      color: WF.muted,
      align: 'center',
    });
    const cols = W >= 1200 ? 4 : 3;
    const gap = 32;
    const cw = Math.min(220, (W - gap * (cols - 1)) / cols);
    const x0 = (W - (cw * cols + gap * (cols - 1))) / 2;
    let y = top + 120;
    for (let row = 0; ; row += 1) {
      const h = Math.min(96, cw - 16) + 64;
      if (y + h > H) break;
      for (let c = 0; c < cols; c += 1) person(u, x0 + c * (cw + gap), y, cw, row * cols + c);
      y += h + 24;
    }
  },
);

function contactForm(u: Ui, x: number, y: number, w: number) {
  const half = (w - 12) / 2;
  u.labelled(x, y, half, 'First Name', 'Jordan');
  y = u.labelled(x + half + 12, y, half, 'Last Name', 'Lee') + 14;
  y = u.labelled(x, y, w, 'Email', 'you@example.com') + 14;
  u.text(x, y, w, 20, 'Message', { size: 13, bold: true, color: WF.body });
  u.block(x, y + 24, w, 120, {
    label: 'How can we help?',
    textSize: 15,
    textColor: WF.muted,
    textAlignX: 'left',
    textAlignY: 'top',
    padding: 'md',
    fillColor: WF.white,
    strokeColor: WF.line,
    strokeWidth: 'thin',
  });
  u.button(x, y + 164, w, 52, 'Send Message');
  return y + 216;
}

export const contact = responsive(
  (u) => {
    const { W } = u;
    const y = topBar(u, 'Contact Us', { back: true });
    u.text(0, y, W, 44, 'We usually reply within a day.', {
      size: 15,
      color: WF.muted,
      alignY: 'top',
    });
    contactForm(u, 0, y + 48, W);
  },
  (u) => {
    const { W } = u;
    const top = topNav(u);
    const col = Math.round(W * 0.4);
    u.text(0, top + 24, col, 100, 'Let’s Talk', {
      size: 44,
      bold: true,
      color: WF.ink,
      alignY: 'top',
    });
    u.text(0, top + 92, col, 50, 'Questions, feedback or a demo: we usually reply within a day.', {
      size: 17,
      color: WF.muted,
      alignY: 'top',
    });
    [
      ['mail', 'hello@example.com'],
      ['phone', '+44 20 7946 0000'],
      ['map-pin', '12 High Street, London'],
    ].forEach(([iconId, line], i) => {
      const y = top + 172 + i * 48;
      u.block(0, y, 40, 40, { fillColor: WF.soft, borderRadius: 'md' });
      u.icon(10, y + 10, 20, iconId!, WF.ink);
      u.text(56, y, col - 56, 40, line!, { size: 15, color: WF.body });
    });
    const x = col + 64;
    u.card(x, top + 8, W - x, 420);
    contactForm(u, x + 28, top + 36, W - x - 56);
  },
);

const POSTS = [
  'How Small Teams Ship Faster',
  'The Five Minute Standup',
  'Design Reviews That Work',
  'Writing Briefs People Read',
  'Saying No to Features',
  'Our Quiet Launch',
];

function postCard(u: Ui, x: number, y: number, w: number, i: number, pic: number) {
  u.picture(x, y, w, pic, 'md');
  u.chip(x, y + pic + 12, ['Design', 'Process', 'Company'][i % 3]!, false, 26);
  u.text(x, y + pic + 46, w, 26, POSTS[i % POSTS.length]!, { size: 17, bold: true, color: WF.ink });
  u.text(x, y + pic + 74, w, 20, `Jordan Lee · ${4 + (i % 4)} min read`, {
    size: 13,
    color: WF.muted,
  });
  return pic + 100;
}

export const blog = responsive(
  (u) => {
    const { W, H } = u;
    let y = topBar(u, 'Blog', { action: 'search' });
    let cx = 0;
    ['All', 'Design', 'Process', 'Company'].forEach((c, i) => {
      cx += u.chip(cx, y, c, i === 0) + 8;
    });
    y += 52;
    for (let i = 0; ; i += 1) {
      const h = 160 + 100;
      if (y + h > H) break;
      postCard(u, 0, y, W, i, 160);
      y += h + 16;
    }
  },
  (u) => {
    const { W, H } = u;
    const top = topNav(u);
    u.heading(0, top, 400, 'Blog', 34);
    const fh = Math.min(320, H - top - 60 - 140);
    u.picture(0, top + 60, Math.round(W * 0.58), fh, 'lg');
    const fx = Math.round(W * 0.58) + 32;
    u.chip(fx, top + 76, 'Featured', true, 28);
    u.text(fx, top + 116, W - fx, 90, POSTS[0]!, {
      size: 30,
      bold: true,
      color: WF.ink,
      alignY: 'top',
    });
    u.lines(fx, top + 212, W - fx, 3);
    const y = top + 60 + fh + 32;
    const cols = 3;
    const gap = 24;
    const cw = (W - gap * (cols - 1)) / cols;
    const pic = Math.max(80, Math.min(160, H - y - 100));
    if (y + pic + 100 <= H + 1)
      for (let c = 0; c < cols; c += 1) postCard(u, c * (cw + gap), y, cw, c + 1, pic);
  },
);

// ---- Travel -----------------------------------------------------------------------------------

function flightForm(u: Ui, x: number, y: number, w: number, wide: boolean) {
  let cx = x;
  ['Return', 'One Way', 'Multi-City'].forEach((c, i) => {
    cx += u.chip(cx, y, c, i === 0) + 8;
  });
  y += 52;
  const fields: [string, string, string][] = [
    ['From', 'London (LHR)', 'map-pin'],
    ['To', 'Lisbon (LIS)', 'map-pin'],
    ['Depart', 'Fri 23 Oct', 'calendar'],
    ['Return', 'Mon 26 Oct', 'calendar'],
  ];
  if (wide) {
    const fw = (w - 3 * 12 - 160) / 4;
    fields.forEach(([label, value], i) => {
      u.text(x + i * (fw + 12), y, fw, 20, label, { size: 12, bold: true, color: WF.muted });
      u.field(x + i * (fw + 12), y + 24, fw, 52, value, i < 2 ? 'map-pin' : 'calendar');
    });
    u.button(x + w - 160, y + 24, 160, 52, 'Search');
    return y + 76;
  }
  fields.forEach(([label, value, iconId], i) => {
    u.text(x, y + i * 80, w, 20, label, { size: 12, bold: true, color: WF.muted });
    u.field(x, y + i * 80 + 22, w, 50, value, iconId);
  });
  y += 320;
  u.field(x, y, w, 50, '1 adult · Economy', 'users');
  u.button(x, y + 66, w, 56, 'Search Flights');
  return y + 122;
}

function flightResult(u: Ui, x: number, y: number, w: number, i: number) {
  u.card(x, y, w, 76);
  u.text(x + 16, y + 12, 120, 26, ['07:10', '09:45', '13:20', '18:05'][i % 4]!, {
    size: 18,
    bold: true,
    color: WF.ink,
  });
  u.text(x + 16, y + 40, 120, 20, 'LHR', { size: 13, color: WF.muted });
  u.divider(x + 120, y + 30, w - 360);
  u.text(x + 120, y + 38, w - 360, 18, `2h ${40 + i * 5}m · Direct`, {
    size: 12,
    color: WF.muted,
    align: 'center',
  });
  u.text(x + w - 230, y + 12, 100, 26, ['09:50', '12:25', '16:00', '20:45'][i % 4]!, {
    size: 18,
    bold: true,
    color: WF.ink,
  });
  u.text(x + w - 230, y + 40, 100, 20, 'LIS', { size: 13, color: WF.muted });
  u.text(x + w - 120, y + 22, 104, 32, `£${84 + i * 23}`, {
    size: 20,
    bold: true,
    color: WF.ink,
    align: 'right',
  });
}

export const flightSearch = responsive(
  (u) => {
    const y = topBar(u, 'Flights', { action: 'user' });
    flightForm(u, 0, y, u.W, false);
    tabBar(u, [
      ['search', 'Search'],
      ['bookmark', 'Trips'],
      ['bell', 'Alerts'],
      ['user', 'Profile'],
    ]);
  },
  (u) => {
    const { W, H } = u;
    const top = topNav(u, ['Flights', 'Hotels', 'Cars'], 'avatar');
    u.heading(0, top, 600, 'Where to Next?', 32);
    let y = flightForm(u, 0, top + 60, W, true) + 32;
    u.text(0, y, W, 22, '42 flights · Cheapest first', { size: 15, bold: true, color: WF.ink });
    y += 36;
    for (let i = 0; y + 76 <= H; i += 1) {
      flightResult(u, 0, y, W, i);
      y += 88;
    }
  },
);

function pass(u: Ui, x: number, y: number, w: number, h: number) {
  u.card(x, y, w, h);
  u.block(x, y, w, 64, { fillColor: WF.ink, borderRadius: 'lg' });
  u.text(x + 20, y, w - 40, 64, 'Boarding Pass', { size: 17, bold: true, color: WF.white });
  u.text(x + w - 140, y, 120, 64, 'Flight YA 214', { size: 13, color: WF.line, align: 'right' });
  const big = (cx: number, code: string, city: string, align: 'left' | 'right') => {
    u.text(cx, y + 84, w / 2 - 20, 48, code, { size: 40, bold: true, color: WF.ink, align });
    u.text(cx, y + 132, w / 2 - 20, 20, city, { size: 13, color: WF.muted, align });
  };
  big(x + 20, 'LHR', 'London', 'left');
  big(x + w / 2, 'LIS', 'Lisbon', 'right');
  u.icon(x + w / 2 - 14, y + 98, 28, 'arrow-right', WF.ink);
  const facts: [string, string][] = [
    ['Passenger', 'Jordan Lee'],
    ['Seat', '14A'],
    ['Gate', 'B32'],
    ['Boards', '06:40'],
  ];
  const fw = (w - 40) / 2;
  facts.forEach(([k, v], i) => {
    const fx = x + 20 + (i % 2) * fw;
    const fy = y + 176 + Math.floor(i / 2) * 56;
    u.text(fx, fy, fw, 18, k.toUpperCase(), { size: 11, bold: true, color: WF.muted });
    u.text(fx, fy + 18, fw, 26, v, { size: 18, bold: true, color: WF.ink });
  });
  // The tear line and a barcode of bars.
  const ty = y + 300;
  u.divider(x + 16, ty, w - 32);
  const bw = Math.min(w - 64, 260);
  for (let i = 0; i < 40; i += 1) {
    const thick = i % 3 === 0 ? 4 : 2;
    u.block(x + (w - bw) / 2 + (i * bw) / 40, ty + 20, thick, Math.max(40, h - 340), {
      fillColor: WF.ink,
      borderRadius: 'none',
    });
  }
}

export const boardingPass = responsive(
  (u) => {
    topBar(u, 'Your Trip', { back: true, action: 'share' });
    pass(u, 0, 64, u.W, Math.min(460, u.H - 140));
    u.button(0, u.H - 52, u.W, 52, 'Add to Wallet', 'secondary');
  },
  (u) => {
    const { W, H } = u;
    const w = Math.min(440, W);
    pass(u, (W - w) / 2, Math.max(0, (H - 460) / 2), w, Math.min(460, H));
  },
);

const RIDES: readonly [string, string, string, string][] = [
  ['Standard', '4 seats · 3 min away', '£12.40', 'zap'],
  ['Comfort', 'Newer cars · 5 min away', '£16.10', 'star'],
  ['XL', '6 seats · 8 min away', '£21.80', 'users'],
];

function rideOptions(u: Ui, x: number, y: number, w: number) {
  RIDES.forEach(([name, line, price, iconId], i) => {
    const ry = y + i * 70;
    u.block(x, ry, w, 62, {
      fillColor: i === 0 ? WF.soft : WF.white,
      strokeColor: i === 0 ? WF.ink : WF.line,
      strokeWidth: 'thin',
      borderRadius: 'lg',
    });
    u.icon(x + 14, ry + 19, 24, iconId, WF.ink);
    u.text(x + 52, ry + 8, w - 150, 22, name, { size: 15, bold: true, color: WF.ink });
    u.text(x + 52, ry + 30, w - 150, 20, line, { size: 12, color: WF.muted });
    u.text(x + w - 96, ry, 80, 62, price, { size: 16, bold: true, color: WF.ink, align: 'right' });
  });
  return y + RIDES.length * 70;
}

// A map's ground with a route drawn across it.
function routeMap(u: Ui, x: number, y: number, w: number, h: number) {
  u.block(x, y, w, h, { fillColor: WF.soft, borderRadius: 'lg' });
  u.block(x, y + h * 0.4, w, 14, { fillColor: WF.white, borderRadius: 'none' });
  u.block(x + w * 0.6, y, 14, h, { fillColor: WF.white, borderRadius: 'none' });
  u.block(x + w * 0.2, y + h * 0.4 + 5, w * 0.4 + 7, 4, {
    fillColor: WF.ink,
    borderRadius: 'full',
  });
  u.block(x + w * 0.6 + 5, y + h * 0.18, 4, h * 0.22 + 7, {
    fillColor: WF.ink,
    borderRadius: 'full',
  });
  u.els.push(
    u.k.shape('circle', x + w * 0.2 - 10, y + h * 0.4 - 3, 20, 20, {
      label: '',
      fillColor: WF.white,
      strokeColor: WF.ink,
      strokeWidth: 'thick',
    }),
  );
  u.els.push(
    u.k.shape('circle', x + w * 0.6 - 3, y + h * 0.18 - 13, 20, 20, {
      label: '',
      fillColor: WF.ink,
      strokeWidth: 'none',
    }),
  );
}

export const ride = responsive(
  (u) => {
    const { W, H } = u;
    const sheet = H - 330;
    routeMap(u, -16, -8, W + 32, sheet + 24);
    u.field(0, 8, W, 48, 'Where to?', 'search');
    u.block(-16, sheet, W + 32, 346, {
      fillColor: WF.white,
      strokeColor: WF.line,
      strokeWidth: 'thin',
      borderRadius: 'lg',
    });
    u.block(W / 2 - 20, sheet + 10, 40, 5, { fillColor: WF.line, borderRadius: 'full' });
    u.text(0, sheet + 26, W, 24, 'Choose a Ride', { size: 17, bold: true, color: WF.ink });
    rideOptions(u, 0, sheet + 60, W);
    u.button(0, H - 52, W, 52, 'Confirm Standard');
  },
  (u) => {
    const { W, H } = u;
    const lw = Math.min(400, Math.round(W * 0.34));
    u.text(0, 0, lw, 30, 'Get a Ride', { size: 26, bold: true, color: WF.ink });
    u.field(0, 48, lw, 48, 'Pickup: 12 High Street', 'map-pin');
    u.field(0, 108, lw, 48, 'Where to?', 'search');
    const y = rideOptions(u, 0, 180, lw);
    u.button(0, y + 12, lw, 52, 'Confirm Standard');
    routeMap(u, lw + 24, 0, W - lw - 24, H);
  },
);
