// Wireframe layouts, Start, Shop and Social additions (docs/specs/007-editor/wireframe-pages.md
// "Wireframe layouts"): signing up and verifying, permissions, a cart, a shop's grid, an order's
// tracking, a post with its comments, stories and composing a post. Each a phone column or a wider
// arrangement; pure builders over the safe area (wireframe-layout-kit).
import { APP_NAME, sideNav, tabBar, topBar, topNav, WF, type Ui } from './wireframe-layout-kit';
import { responsive } from './wireframe-layouts-start';

// The product's mark: a dark rounded square with the bolt.
function mark(u: Ui, x: number, y: number, d: number) {
  u.block(x, y, d, d, { fillColor: WF.ink, borderRadius: 'lg' });
  const g = Math.round(d * 0.5);
  u.icon(x + (d - g) / 2, y + (d - g) / 2, g, 'zap', WF.white);
}

// ---- Start ------------------------------------------------------------------------------------

function signUpForm(u: Ui, x: number, y: number, w: number) {
  u.text(x, y, w, 38, 'Create Your Account', { size: 28, bold: true, color: WF.ink });
  u.text(x, y + 40, w, 22, 'Free for 14 days, no card needed.', { size: 15, color: WF.muted });
  y = u.labelled(x, y + 84, w, 'Full Name', 'Jordan Lee') + 14;
  y = u.labelled(x, y, w, 'Email', 'you@example.com') + 14;
  y = u.labelled(x, y, w, 'Password', 'At least 8 characters') + 16;
  u.block(x, y + 2, 18, 18, { fillColor: WF.ink, borderRadius: 'sm' });
  u.icon(x + 2, y + 4, 14, 'check', WF.white);
  u.text(x + 28, y, w - 28, 22, 'I agree to the Terms and Privacy Policy', {
    size: 13,
    color: WF.body,
  });
  u.button(x, y + 40, w, 52, 'Create Account');
  u.text(x, y + 108, w, 22, 'Already have an account? Sign In', {
    size: 14,
    color: WF.muted,
    align: 'center',
  });
}

export const signUp = responsive(
  (u) => signUpForm(u, 0, topBar(u, '', { back: true }), u.W),
  (u) => {
    const half = Math.round(u.W * 0.46);
    u.block(0, 0, half, u.H, { fillColor: WF.soft, borderRadius: 'lg' });
    mark(u, 40, 40, 48);
    u.text(
      40,
      u.H - 180,
      half - 80,
      100,
      '“We shipped our first release a week after signing up.”',
      {
        size: 22,
        bold: true,
        color: WF.ink,
        alignY: 'top',
      },
    );
    u.avatar(40, u.H - 64, 40);
    u.text(92, u.H - 62, half - 132, 36, 'Priya Patel · Lumen', { size: 14, color: WF.body });
    const w = Math.min(420, u.W - half - 96);
    signUpForm(u, half + (u.W - half - w) / 2, Math.max(0, u.H / 2 - 290), w);
  },
  { column: true },
);

function codeEntry(u: Ui, x: number, y: number, w: number) {
  u.els.push(
    u.k.shape('circle', x + w / 2 - 36, y, 72, 72, {
      label: '',
      fillColor: WF.soft,
      strokeWidth: 'none',
    }),
  );
  u.icon(x + w / 2 - 16, y + 20, 32, 'mail', WF.ink);
  u.text(x, y + 96, w, 34, 'Check Your Email', {
    size: 26,
    bold: true,
    color: WF.ink,
    align: 'center',
  });
  u.text(x, y + 134, w, 44, 'We sent a 6-digit code to you@example.com', {
    size: 15,
    color: WF.muted,
    align: 'center',
    alignY: 'top',
  });
  const box = Math.min(52, (w - 50) / 6);
  const gx = x + (w - (box * 6 + 50)) / 2;
  ['4', '8', '1', '', '', ''].forEach((d, i) =>
    u.block(gx + i * (box + 10), y + 196, box, box + 8, {
      label: d,
      textSize: 24,
      textBold: true,
      textColor: WF.ink,
      fillColor: WF.white,
      strokeColor: i === 3 ? WF.ink : WF.line,
      strokeWidth: i === 3 ? 'medium' : 'thin',
      borderRadius: 'md',
    }),
  );
  u.button(x, y + 288, w, 52, 'Verify');
  u.text(x, y + 356, w, 22, 'Didn’t get it? Resend in 0:42', {
    size: 14,
    color: WF.muted,
    align: 'center',
  });
}

export const verifyCode = responsive(
  (u) => codeEntry(u, 0, topBar(u, '', { back: true }) + 24, u.W),
  (u) => {
    const w = Math.min(440, u.W);
    mark(u, 0, 0, 40);
    u.text(52, 4, 200, 32, APP_NAME, { size: 18, bold: true, color: WF.ink });
    codeEntry(u, (u.W - w) / 2, Math.max(64, u.H / 2 - 200), w);
  },
);

const PERMISSIONS: readonly [string, string, string, boolean][] = [
  ['bell', 'Notifications', 'Reminders for what you plan.', true],
  ['map-pin', 'Location', 'Places near you, never shared.', true],
  ['camera', 'Camera', 'Scan receipts and designs.', false],
  ['users', 'Contacts', 'Find friends already here.', false],
];

function permissionList(u: Ui, x: number, y: number, w: number) {
  PERMISSIONS.forEach(([iconId, title, line, on], i) => {
    const ry = y + i * 76;
    u.card(x, ry, w, 64);
    u.block(x + 12, ry + 12, 40, 40, { fillColor: WF.soft, borderRadius: 'md' });
    u.icon(x + 22, ry + 22, 20, iconId, WF.ink);
    u.text(x + 64, ry + 10, w - 140, 22, title, { size: 15, bold: true, color: WF.ink });
    u.text(x + 64, ry + 32, w - 140, 20, line, { size: 13, color: WF.muted });
    u.toggle(x + w - 63, ry + 17, on);
  });
  return y + PERMISSIONS.length * 76;
}

export const permissions = responsive(
  (u) => {
    const { W, H } = u;
    u.text(0, 24, W, 36, 'Allow Access', { size: 28, bold: true, color: WF.ink });
    u.text(0, 64, W, 44, 'Choose what Your App may use. You can change this in Settings.', {
      size: 15,
      color: WF.muted,
      alignY: 'top',
    });
    permissionList(u, 0, 128, W);
    u.button(0, H - 56, W, 56, 'Continue');
  },
  (u) => {
    const w = Math.min(560, u.W);
    const x = (u.W - w) / 2;
    const top = Math.max(0, u.H / 2 - 260);
    u.text(x, top, w, 40, 'Allow Access', { size: 32, bold: true, color: WF.ink, align: 'center' });
    u.text(x, top + 46, w, 24, 'Choose what Your App may use. You can change this in Settings.', {
      size: 16,
      color: WF.muted,
      align: 'center',
    });
    const y = permissionList(u, x, top + 100, w);
    u.button(x + w / 2 - 100, y + 16, 200, 52, 'Continue');
  },
);

// ---- Shop -------------------------------------------------------------------------------------

const CART: readonly [string, string, string][] = [
  ['Linen Shirt', 'Size M · Sand', '$48.00'],
  ['Canvas Tote', 'One size · Natural', '$32.00'],
  ['Wool Scarf', 'One size · Grey', '$36.00'],
];

function cartRow(u: Ui, x: number, y: number, w: number, i: number) {
  const [name, detail, price] = CART[i % CART.length]!;
  u.picture(x, y, 84, 84, 'md');
  u.text(x + 100, y + 4, w - 200, 22, name, { size: 16, bold: true, color: WF.ink });
  u.text(x + 100, y + 28, w - 200, 20, detail, { size: 13, color: WF.muted });
  u.text(x + w - 90, y + 4, 90, 22, price, { size: 15, bold: true, color: WF.ink, align: 'right' });
  // A stepper: minus, the count, plus.
  u.block(x + 100, y + 54, 96, 30, {
    fillColor: WF.white,
    strokeColor: WF.line,
    strokeWidth: 'thin',
    borderRadius: 'full',
  });
  u.text(x + 100, y + 54, 32, 30, '−', { size: 16, color: WF.ink, align: 'center' });
  u.text(x + 132, y + 54, 32, 30, '1', { size: 14, bold: true, color: WF.ink, align: 'center' });
  u.text(x + 164, y + 54, 32, 30, '+', { size: 16, color: WF.ink, align: 'center' });
}

function totals(u: Ui, x: number, y: number, w: number) {
  const line = (at: number, a: string, b: string, bold = false) => {
    u.text(x, at, w / 2, 22, a, { size: 15, bold, color: bold ? WF.ink : WF.body });
    u.text(x + w / 2, at, w / 2, 22, b, { size: 15, bold, color: WF.ink, align: 'right' });
  };
  line(y, 'Subtotal', '$116.00');
  line(y + 30, 'Delivery', 'Free');
  u.divider(x, y + 64, w);
  line(y + 78, 'Total', '$116.00', true);
  return y + 110;
}

export const cart = responsive(
  (u) => {
    const { W, H } = u;
    let y = topBar(u, 'Cart', { back: true });
    for (let i = 0; i < 3 && y + 96 < H - 230; i += 1) {
      cartRow(u, 0, y, W, i);
      u.divider(0, y + 100, W);
      y += 116;
    }
    u.field(0, y, W - 112, 44, 'Promo code');
    u.button(W - 100, y, 100, 44, 'Apply', 'secondary');
    totals(u, 0, Math.max(y + 64, H - 180), W);
    u.button(0, H - 56, W, 56, 'Checkout');
  },
  (u) => {
    const { W } = u;
    const top = topNav(u, ['Shop', 'New In', 'Sale'], 'avatar');
    u.heading(0, top, 400, 'Your Cart (3)', 30);
    const col = Math.round(W * 0.6);
    let y = top + 64;
    for (let i = 0; i < 3; i += 1) {
      cartRow(u, 0, y, col, i);
      u.divider(0, y + 100, col);
      y += 116;
    }
    const sx = col + 48;
    const sw = W - sx;
    u.card(sx, top + 64, sw, 252);
    u.text(sx + 20, top + 82, sw - 40, 24, 'Summary', { size: 17, bold: true, color: WF.ink });
    const ty = totals(u, sx + 20, top + 122, sw - 40);
    u.button(sx + 20, ty + 8, sw - 40, 52, 'Checkout');
  },
);

const SHOP = [
  'Linen Shirt',
  'Canvas Tote',
  'Wool Scarf',
  'Leather Belt',
  'Cotton Cap',
  'Field Jacket',
  'Knit Beanie',
  'Denim Jeans',
];

// A product: its picture (taller than wide on a phone, `ratio` of its width), name and price.
function productTile(u: Ui, x: number, y: number, w: number, i: number, ratio = 1.15) {
  const pic = Math.round(w * ratio);
  u.picture(x, y, w, pic, 'md');
  u.icon(x + w - 32, y + 10, 22, 'heart', WF.body);
  u.text(x, y + pic + 8, w, 20, SHOP[i % SHOP.length]!, { size: 14, bold: true, color: WF.ink });
  u.text(x, y + pic + 28, w, 20, `$${24 + i * 6}.00`, { size: 14, color: WF.body });
  return pic + 56;
}

export const shopGrid = responsive(
  (u) => {
    const { W, H } = u;
    let y = topBar(u, 'Shop', { action: 'shopping-bag' });
    u.field(0, y, W, 44, 'Search products', 'search');
    y += 60;
    let cx = 0;
    ['All', 'Shirts', 'Bags', 'Hats'].forEach((c, i) => {
      cx += u.chip(cx, y, c, i === 0) + 8;
    });
    y += 52;
    const gap = 12;
    const w = (W - gap) / 2;
    for (let row = 0; ; row += 1) {
      const h = Math.round(w * 1.15) + 56;
      if (y + h > H - 64) break;
      productTile(u, 0, y, w, row * 2);
      productTile(u, w + gap, y, w, row * 2 + 1);
      y += h + 12;
    }
    tabBar(u, [
      ['home', 'Home'],
      ['search', 'Search'],
      ['shopping-bag', 'Bag'],
      ['user', 'Profile'],
    ]);
  },
  (u) => {
    const { W, H } = u;
    const top = topNav(u, ['Shop', 'New In', 'Sale'], 'avatar');
    const side = 200;
    u.text(0, top, side, 24, 'Category', { size: 15, bold: true, color: WF.ink });
    ['All', 'Shirts', 'Bags', 'Hats', 'Outerwear'].forEach((c, i) =>
      u.text(0, top + 36 + i * 32, side, 24, c, {
        size: 15,
        bold: i === 0,
        color: i === 0 ? WF.ink : WF.body,
      }),
    );
    u.text(0, top + 220, side, 24, 'Price', { size: 15, bold: true, color: WF.ink });
    u.block(0, top + 262, side - 24, 4, { fillColor: WF.line, borderRadius: 'full' });
    u.block(30, top + 262, 110, 4, { fillColor: WF.ink, borderRadius: 'full' });
    const x = side + 32;
    const w = W - x;
    u.text(x, top, 300, 28, '128 products', { size: 15, color: WF.muted });
    u.chip(W - 160, top - 4, 'Sort: Popular', false, 34);
    const cols = w >= 1000 ? 4 : 3;
    const gap = 20;
    const tw = (w - gap * (cols - 1)) / cols;
    let y = top + 48;
    for (let row = 0; ; row += 1) {
      const h = Math.round(tw * 0.9) + 56;
      if (row > 0 && y + h > H) break;
      for (let c = 0; c < cols; c += 1)
        productTile(u, x + c * (tw + gap), y, tw, row * cols + c, 0.9);
      y += h + 20;
    }
  },
);

const STEPS: readonly [string, string, boolean][] = [
  ['Order Placed', 'Mon 19 Oct, 9:41', true],
  ['Packed', 'Mon 19 Oct, 14:20', true],
  ['Out for Delivery', 'Tue 20 Oct, 08:05', true],
  ['Delivered', 'Expected by 6 pm', false],
];

function trackingSteps(u: Ui, x: number, y: number, w: number) {
  STEPS.forEach(([title, when, done], i) => {
    const sy = y + i * 72;
    u.els.push(
      u.k.shape('circle', x, sy, 28, 28, {
        label: '',
        fillColor: done ? WF.ink : WF.white,
        strokeColor: done ? WF.ink : WF.line,
        strokeWidth: done ? 'none' : 'medium',
      }),
    );
    if (done) u.icon(x + 6, sy + 6, 16, 'check', WF.white);
    if (i < STEPS.length - 1)
      u.block(x + 13, sy + 30, 2, 40, { fillColor: done ? WF.ink : WF.line, borderRadius: 'none' });
    u.text(x + 44, sy, w - 44, 22, title, {
      size: 15,
      bold: true,
      color: done ? WF.ink : WF.muted,
    });
    u.text(x + 44, sy + 22, w - 44, 18, when, { size: 13, color: WF.muted });
  });
  return y + STEPS.length * 72;
}

export const orderTracking = responsive(
  (u) => {
    const { W, H } = u;
    const top = topBar(u, 'Order #1042', { back: true });
    u.block(0, top, W, 180, { fillColor: WF.soft, borderRadius: 'lg' });
    u.icon(W / 2 - 16, top + 60, 32, 'truck', WF.ink);
    u.text(0, top + 100, W, 22, 'Arriving today', {
      size: 16,
      bold: true,
      color: WF.ink,
      align: 'center',
    });
    const y = trackingSteps(u, 0, top + 204, W);
    if (y + 64 < H) u.button(0, H - 52, W, 52, 'Contact Courier', 'secondary');
  },
  (u) => {
    const { W, H } = u;
    const top = topNav(u, ['Shop', 'Orders', 'Help'], 'avatar');
    u.heading(0, top, 500, 'Order #1042 · Arriving Today', 28);
    const col = Math.round(W * 0.42);
    trackingSteps(u, 0, top + 72, col);
    const mx = col + 48;
    u.block(mx, top + 72, W - mx, Math.min(360, H - top - 72), {
      fillColor: WF.soft,
      borderRadius: 'lg',
    });
    u.icon(mx + (W - mx) / 2 - 18, top + 220, 36, 'truck', WF.ink);
    u.card(mx, Math.min(H - 120, top + 456), W - mx, 100);
    cartRow(u, mx + 16, Math.min(H - 112, top + 464), W - mx - 32, 0);
  },
);

// ---- Social -----------------------------------------------------------------------------------

const COMMENTS: readonly [string, string][] = [
  ['Sam Rivera', 'This is gorgeous, where was it taken?'],
  ['Priya Patel', 'The light in this one is perfect.'],
  ['Alex Morgan', 'Adding it to my list for next summer.'],
  ['Mia Novak', 'Wow. Just wow.'],
];

function postHeader(u: Ui, x: number, y: number, w: number) {
  u.avatar(x, y, 40);
  u.text(x + 52, y, w - 90, 20, 'Jordan Lee', { size: 15, bold: true, color: WF.ink });
  u.text(x + 52, y + 20, w - 90, 18, 'Lake District · 2h', { size: 12, color: WF.muted });
  u.icon(x + w - 24, y + 8, 24, 'more-horizontal', WF.ink);
}

function reactions(u: Ui, x: number, y: number) {
  u.icon(x, y, 24, 'heart', WF.ink);
  u.icon(x + 40, y, 24, 'message', WF.ink);
  u.icon(x + 80, y, 24, 'share', WF.ink);
  u.text(x + 120, y, 200, 24, '1,284 likes', { size: 14, bold: true, color: WF.ink });
}

function commentList(u: Ui, x: number, y: number, w: number, bottom: number) {
  for (const [who, line] of COMMENTS) {
    if (y + 52 > bottom) break;
    u.avatar(x, y, 32);
    u.text(x + 44, y - 2, w - 44, 20, who, { size: 14, bold: true, color: WF.ink });
    u.text(x + 44, y + 18, w - 44, 20, line, { size: 14, color: WF.body });
    y += 56;
  }
}

export const postDetail = responsive(
  (u) => {
    const { W, H } = u;
    postHeader(u, 0, 0, W);
    const pic = Math.min(W, H * 0.42);
    u.picture(-16, 56, W + 32, pic, 'none');
    let y = 56 + pic + 14;
    reactions(u, 0, y);
    u.text(0, y + 34, W, 40, 'Morning swim before anyone else was up. Worth the cold.', {
      size: 14,
      color: WF.body,
      alignY: 'top',
    });
    y += 88;
    commentList(u, 0, y, W, H - 56);
    u.field(0, H - 44, W, 44, 'Add a comment…');
  },
  (u) => {
    const { W, H } = u;
    const pic = Math.round(W * 0.58);
    u.picture(0, 0, pic, H, 'md');
    const x = pic + 28;
    const w = W - x;
    postHeader(u, x, 0, w);
    u.divider(x, 56, w);
    u.text(x, 72, w, 44, 'Morning swim before anyone else was up. Worth the cold.', {
      size: 15,
      color: WF.body,
      alignY: 'top',
    });
    commentList(u, x, 136, w, H - 110);
    u.divider(x, H - 96, w);
    reactions(u, x, H - 84);
    u.field(x, H - 48, w, 48, 'Add a comment…');
  },
);

function storyRow(u: Ui, x: number, y: number, w: number, d: number) {
  const names = ['You', 'Sam', 'Priya', 'Alex', 'Mia', 'Chris', 'Leo', 'Ava', 'Noah'];
  const step = d + 18;
  names.forEach((n, i) => {
    const sx = x + i * step;
    if (sx + d > x + w) return;
    u.els.push(
      u.k.shape('circle', sx - 3, y - 3, d + 6, d + 6, {
        label: '',
        fillColor: 'transparent',
        strokeColor: i === 0 ? WF.line : WF.ink,
        strokeWidth: 'medium',
      }),
    );
    u.avatar(sx, y, d);
    u.text(sx - 8, y + d + 6, d + 16, 18, n, { size: 12, color: WF.body, align: 'center' });
  });
}

export const stories = responsive(
  (u) => {
    const { W, H } = u;
    let y = topBar(u, APP_NAME, { action: 'send' });
    storyRow(u, 0, y, W, 60);
    y += 104;
    u.divider(-16, y, W + 32);
    y += 16;
    postHeader(u, 0, y, W);
    const pic = Math.min(W, H - y - 160);
    u.picture(-16, y + 52, W + 32, pic, 'none');
    reactions(u, 0, y + 64 + pic);
    tabBar(u);
  },
  (u) => {
    const { W, H } = u;
    const side = sideNav(u, [
      ['home', 'Home'],
      ['search', 'Explore'],
      ['message', 'Messages'],
      ['bell', 'Notifications'],
      ['user', 'Profile'],
    ]);
    const w = Math.min(560, W - side - 48);
    const x = side + 48;
    storyRow(u, x, 4, w, 64);
    postHeader(u, x, 120, w);
    const pic = Math.min(w, H - 120 - 120);
    u.picture(x, 172, w, pic, 'md');
    reactions(u, x, 186 + pic);
    const rx = x + w + 48;
    if (rx + 240 > W) return;
    u.text(rx, 4, W - rx, 22, 'Suggested for You', { size: 15, bold: true, color: WF.ink });
    ['Ava Brooks', 'Noah Kim', 'Leo Grant'].forEach((n, i) => {
      const ry = 44 + i * 60;
      u.avatar(rx, ry, 40);
      u.text(rx + 52, ry + 8, W - rx - 140, 22, n, { size: 14, bold: true, color: WF.ink });
      u.text(W - 70, ry + 8, 70, 22, 'Follow', {
        size: 14,
        bold: true,
        color: WF.ink,
        align: 'right',
      });
    });
  },
);

export const composePost = responsive(
  (u) => {
    const { W, H } = u;
    u.text(0, 4, 80, 32, 'Cancel', { size: 16, color: WF.body });
    u.button(W - 84, 0, 84, 38, 'Post');
    u.avatar(0, 60, 44);
    u.text(56, 64, W - 56, 72, 'What’s happening?', { size: 20, color: WF.muted, alignY: 'top' });
    const pic = (W - 12) / 2;
    u.picture(56, 160, pic - 28, pic, 'md');
    u.picture(56 + pic - 16, 160, pic - 28, pic, 'md');
    u.chip(56, 172 + pic, 'Everyone can reply', false, 32);
    const y = H - 52;
    u.divider(-16, y - 8, W + 32);
    ['image', 'camera', 'map-pin', 'smile', 'calendar'].forEach((iconId, i) =>
      u.icon(i * 48, y + 6, 24, iconId, WF.ink),
    );
    u.text(W - 60, y + 6, 60, 24, '240', { size: 13, color: WF.muted, align: 'right' });
  },
  (u) => {
    const { W, H } = u;
    const w = Math.min(640, W);
    const x = (W - w) / 2;
    const h = Math.min(H, 420);
    const y = (H - h) / 2;
    // The screen behind the dialog, dimmed.
    u.block(-32, -96, W + 64, H + 128, { fillColor: WF.soft, borderRadius: 'none' });
    u.card(x, y, w, h);
    u.text(x + 24, y + 18, w - 48, 26, 'New Post', { size: 18, bold: true, color: WF.ink });
    u.icon(x + w - 44, y + 20, 22, 'x', WF.body);
    u.divider(x, y + 60, w);
    u.avatar(x + 24, y + 80, 44);
    u.text(x + 80, y + 86, w - 104, 80, 'What’s happening?', {
      size: 20,
      color: WF.muted,
      alignY: 'top',
    });
    u.picture(x + 80, y + 170, 180, 120, 'md');
    u.divider(x, y + h - 72, w);
    ['image', 'camera', 'map-pin', 'smile'].forEach((iconId, i) =>
      u.icon(x + 24 + i * 44, y + h - 50, 24, iconId, WF.ink),
    );
    u.button(x + w - 124, y + h - 58, 100, 44, 'Post');
  },
);
