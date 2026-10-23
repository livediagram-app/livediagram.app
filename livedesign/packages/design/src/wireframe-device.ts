// A wireframe page's device (docs/specs/007-editor/wireframe-pages.md "The devices"): what the
// page is framed as, its screen at the device's logical resolution, and the frame round it. The
// page's rect is the whole frame; the screen sits inset in it. Pure data and geometry: the canvas,
// every export and the agents' previews read it, so a frame changes in one place.
//
// A LEAF module: nothing from './page' (which reads the geometry here for a page's sides).

export type WireframeDeviceId =
  | 'iphone'
  | 'iphone-duo'
  | 'android'
  | 'ipad'
  | 'android-tablet'
  | 'laptop'
  | 'desktop'
  | 'browser'
  | 'watch';

export type WireframeDeviceClass = 'phone' | 'tablet' | 'computer' | 'watch';

// How the frame is drawn: in the tab's Theme (absent), Dark, Light, or Outline (a line drawing,
// no fill).
export type WireframeFrameLook = 'theme' | 'dark' | 'light' | 'outline';

export const WIREFRAME_FRAME_LOOKS: readonly WireframeFrameLook[] = [
  'theme',
  'dark',
  'light',
  'outline',
];

export const WIREFRAME_FRAME_LOOK_LABEL: Record<WireframeFrameLook, string> = {
  theme: 'Theme',
  dark: 'Dark',
  light: 'Light',
  outline: 'Outline',
};

// The device a wireframe page without one is read as.
export const DEFAULT_WIREFRAME_DEVICE: WireframeDeviceId = 'iphone';

type DeviceInfo = {
  label: string;
  // The device tiles' shorter name, where the label is long.
  short?: string;
  deviceClass: WireframeDeviceClass;
  // The screen's logical size in CSS px, portrait.
  screen: { width: number; height: number };
  // A phone or tablet turns to landscape; a computer and the watch do not.
  turns: boolean;
  // Held landscape by default (the iPhone Duo opened like a book): a new page of it starts turned.
  landscape?: true;
};

export const WIREFRAME_DEVICES: Readonly<Record<WireframeDeviceId, DeviceInfo>> = {
  iphone: {
    label: 'iPhone',
    deviceClass: 'phone',
    screen: { width: 393, height: 852 },
    turns: true,
  },
  // Apple's book-style foldable (announced September 2026), opened: one 7.6-inch inner screen,
  // 1878 x 2670 px at 3x, so 626 x 890 points, held open landscape (890 x 626) like a passport.
  'iphone-duo': {
    label: 'iPhone Duo',
    deviceClass: 'phone',
    screen: { width: 626, height: 890 },
    turns: true,
    landscape: true,
  },
  android: {
    label: 'Android Phone',
    short: 'Android',
    deviceClass: 'phone',
    screen: { width: 412, height: 915 },
    turns: true,
  },
  ipad: { label: 'iPad', deviceClass: 'tablet', screen: { width: 820, height: 1180 }, turns: true },
  'android-tablet': {
    label: 'Android Tablet',
    short: 'Android',
    deviceClass: 'tablet',
    screen: { width: 800, height: 1280 },
    turns: true,
  },
  laptop: {
    label: 'Laptop',
    deviceClass: 'computer',
    screen: { width: 1440, height: 900 },
    turns: false,
  },
  desktop: {
    label: 'Desktop',
    deviceClass: 'computer',
    screen: { width: 1920, height: 1080 },
    turns: false,
  },
  browser: {
    label: 'Browser',
    deviceClass: 'computer',
    screen: { width: 1440, height: 900 },
    turns: false,
  },
  watch: {
    label: 'Watch',
    deviceClass: 'watch',
    screen: { width: 198, height: 242 },
    turns: false,
  },
};

export const WIREFRAME_DEVICE_IDS = Object.keys(WIREFRAME_DEVICES) as WireframeDeviceId[];

// The device tiles' groups, in order (the Device popover, Choose a Device).
export const WIREFRAME_DEVICE_GROUPS: readonly {
  deviceClass: WireframeDeviceClass;
  label: string;
  devices: readonly WireframeDeviceId[];
}[] = [
  { deviceClass: 'phone', label: 'Phones', devices: ['iphone', 'iphone-duo', 'android'] },
  { deviceClass: 'tablet', label: 'Tablets', devices: ['ipad', 'android-tablet'] },
  { deviceClass: 'computer', label: 'Computers', devices: ['laptop', 'desktop', 'browser'] },
  { deviceClass: 'watch', label: 'Watch', devices: ['watch'] },
];

// The gutter each side of the safe area, by class (docs/specs/007-editor/wireframe-pages.md
// "The screen"): the room a screen's content keeps from its edges.
export const WIREFRAME_GUTTER: Record<WireframeDeviceClass, number> = {
  phone: 16,
  tablet: 24,
  computer: 32,
  // A watch face's corners are deep: its content keeps further in.
  watch: 12,
};

export function isWireframeDeviceId(v: unknown): v is WireframeDeviceId {
  return typeof v === 'string' && Object.hasOwn(WIREFRAME_DEVICES, v);
}

export function isWireframeFrameLook(v: unknown): v is WireframeFrameLook {
  return v === 'theme' || v === 'dark' || v === 'light' || v === 'outline';
}

type Rect = { x: number; y: number; width: number; height: number };

// A screen's corner radii, clockwise from the top-left.
export type CornerRadii = readonly [number, number, number, number];

export type DeviceGeometry = {
  device: WireframeDeviceId;
  landscape: boolean;
  // The page's sides: the whole frame.
  width: number;
  height: number;
  // The screen, from the page's top-left: its whole span.
  screen: Rect;
  radii: CornerRadii;
  // What the system bars take from each edge of the screen while shown (0 where there is none).
  bars: { top: number; right: number; bottom: number; left: number };
};

const round4 = (r: number): CornerRadii => [r, r, r, r];

/** The device's frame and screen, turned when `landscape` and the device turns. */
export function deviceGeometry(device: WireframeDeviceId, landscape = false): DeviceGeometry {
  const turned = landscape && WIREFRAME_DEVICES[device].turns;
  const g = portraitGeometry(device);
  return turned ? turnedGeometry(g) : g;
}

function geometry(
  device: WireframeDeviceId,
  width: number,
  height: number,
  screen: Rect,
  radii: CornerRadii,
  bars: Partial<DeviceGeometry['bars']> = {},
): DeviceGeometry {
  return {
    device,
    landscape: false,
    width,
    height,
    screen,
    radii,
    bars: { top: 0, right: 0, bottom: 0, left: 0, ...bars },
  };
}

// Each device upright. The numbers are the frame's own proportions: a bezel, the room the side
// buttons stand out by, a laptop's base, a monitor's stand, a browser's toolbar.
function portraitGeometry(device: WireframeDeviceId): DeviceGeometry {
  const { width: sw, height: sh } = WIREFRAME_DEVICES[device].screen;
  switch (device) {
    case 'iphone': {
      const bezel = IPHONE.bezel;
      const side = PHONE_BUTTON_ROOM;
      return geometry(
        device,
        sw + 2 * (bezel + side),
        sh + 2 * bezel,
        { x: bezel + side, y: bezel, width: sw, height: sh },
        round4(IPHONE.screenRadius),
        { top: IPHONE.statusBar, bottom: IPHONE.homeBar },
      );
    }
    case 'iphone-duo': {
      // One inner screen, the fold across its middle; the side buttons stand out of the body.
      const bezel = DUO.bezel;
      const side = PHONE_BUTTON_ROOM;
      return geometry(
        device,
        sw + 2 * (bezel + side),
        sh + 2 * bezel,
        { x: bezel + side, y: bezel, width: sw, height: sh },
        round4(DUO.screenRadius),
        { top: DUO.statusBar, bottom: DUO.homeBar },
      );
    }
    case 'android': {
      const bezel = ANDROID.bezel;
      const side = PHONE_BUTTON_ROOM;
      return geometry(
        device,
        sw + 2 * (bezel + side),
        sh + 2 * bezel,
        { x: bezel + side, y: bezel, width: sw, height: sh },
        round4(ANDROID.screenRadius),
        { top: ANDROID.statusBar, bottom: ANDROID.homeBar },
      );
    }
    case 'ipad':
    case 'android-tablet': {
      const t = device === 'ipad' ? IPAD : ANDROID_TABLET;
      return geometry(
        device,
        sw + 2 * t.bezel,
        sh + 2 * t.bezel,
        { x: t.bezel, y: t.bezel, width: sw, height: sh },
        round4(t.screenRadius),
        { top: t.statusBar, bottom: t.homeBar },
      );
    }
    case 'laptop': {
      const lidW = sw + 2 * LAPTOP.side;
      const lidH = sh + LAPTOP.top + LAPTOP.bottom;
      const baseW = lidW + 2 * LAPTOP.baseOverhang;
      return geometry(
        device,
        baseW,
        lidH + LAPTOP.baseHeight,
        { x: LAPTOP.baseOverhang + LAPTOP.side, y: LAPTOP.top, width: sw, height: sh },
        [LAPTOP.screenRadius, LAPTOP.screenRadius, 0, 0],
      );
    }
    case 'desktop': {
      const w = sw + 2 * DESKTOP.bezel;
      const h = sh + DESKTOP.bezel + DESKTOP.chin;
      return geometry(
        device,
        w,
        h + DESKTOP.neckHeight + DESKTOP.footHeight,
        { x: DESKTOP.bezel, y: DESKTOP.bezel, width: sw, height: sh },
        round4(DESKTOP.screenRadius),
      );
    }
    case 'browser':
      return geometry(
        device,
        sw + 2 * BROWSER.border,
        sh + BROWSER.toolbar + BROWSER.border,
        { x: BROWSER.border, y: BROWSER.toolbar, width: sw, height: sh },
        [0, 0, BROWSER.radius - BROWSER.border, BROWSER.radius - BROWSER.border],
      );
    case 'watch': {
      const caseW = sw + 2 * WATCH.bezel;
      return geometry(
        device,
        caseW + 2 * WATCH.crownRoom,
        sh + 2 * WATCH.bezel + 2 * WATCH.band,
        { x: WATCH.crownRoom + WATCH.bezel, y: WATCH.band + WATCH.bezel, width: sw, height: sh },
        round4(WATCH.screenRadius),
        { top: WATCH.statusBar, bottom: WATCH.footRoom },
      );
    }
  }
}

// A phone or tablet turned a quarter anticlockwise (its top to the left, as a phone is held to
// watch a video): the frame's sides swap, the screen with them. A phone shows no status bar
// turned; its camera side keeps clear, and the home indicator moves to the new foot.
function turnedGeometry(g: DeviceGeometry): DeviceGeometry {
  // The Duo opened keeps its bars turned, as a tablet does: landscape is how it is held.
  const phone = WIREFRAME_DEVICES[g.device].deviceClass === 'phone' && g.device !== 'iphone-duo';
  // (x, y) upright lands at (y, W - x): a rect's left edge becomes its foot.
  const turn = (r: Rect): Rect => ({
    x: r.y,
    y: g.width - r.x - r.width,
    width: r.height,
    height: r.width,
  });
  return {
    ...g,
    landscape: true,
    width: g.height,
    height: g.width,
    screen: turn(g.screen),
    bars: phone
      ? { top: 0, right: 0, bottom: PHONE_LANDSCAPE_HOME, left: PHONE_LANDSCAPE_CAMERA }
      : g.bars,
  };
}

// The frames' proportions, in CSS px.
const PHONE_BUTTON_ROOM = 3;
// The iPhone Duo opened: a thin even bezel, an iPad-like status bar (its FaceTime camera is under
// the display, so no island) and home indicator.
export const DUO = { bezel: 11, bodyRadius: 44, screenRadius: 32, statusBar: 32, homeBar: 20 };
export const IPHONE = {
  bezel: 12,
  bodyRadius: 62,
  screenRadius: 50,
  statusBar: 54,
  homeBar: 34,
  island: { width: 124, height: 36, top: 11 },
} as const;
export const ANDROID = {
  bezel: 10,
  bodyRadius: 42,
  screenRadius: 32,
  statusBar: 36,
  homeBar: 24,
  camera: { r: 6, top: 18 },
} as const;
export const IPAD = { bezel: 22, bodyRadius: 40, screenRadius: 20, statusBar: 24, homeBar: 20 };
export const ANDROID_TABLET = {
  bezel: 28,
  bodyRadius: 34,
  screenRadius: 12,
  statusBar: 28,
  homeBar: 24,
};
export const LAPTOP = {
  side: 20,
  top: 30,
  bottom: 22,
  lidRadius: 22,
  screenRadius: 8,
  // A little wider than the lid, as a laptop is: the page (its title bar, the + after it) keeps to
  // the lid's edges.
  baseOverhang: 28,
  baseHeight: 22,
} as const;
export const DESKTOP = {
  bezel: 18,
  chin: 54,
  radius: 18,
  screenRadius: 4,
  neckWidth: 300,
  neckHeight: 150,
  footWidth: 620,
  footHeight: 24,
} as const;
export const BROWSER = { border: 1, toolbar: 52, radius: 12 } as const;
export const WATCH = {
  bezel: 14,
  caseRadius: 60,
  screenRadius: 48,
  crownRoom: 10,
  band: 46,
  statusBar: 30,
  // Room kept clear above the face's rounded foot (no home indicator is drawn).
  footRoom: 24,
} as const;
// A turned phone: the home indicator's room at its foot, and the room its camera side keeps.
const PHONE_LANDSCAPE_HOME = 21;
const PHONE_LANDSCAPE_CAMERA = 48;

/** The screen's safe area: the screen less the system bars (while shown) and the class's gutter,
 *  from the page's top-left. */
export function deviceSafeArea(g: DeviceGeometry, systemBars: boolean): Rect {
  const gutter = WIREFRAME_GUTTER[WIREFRAME_DEVICES[g.device].deviceClass];
  const b = systemBars ? g.bars : { top: 0, right: 0, bottom: 0, left: 0 };
  // A turned phone's camera side is kept clear with or without the bars: the camera is always there.
  const camera = g.landscape ? g.bars.left : 0;
  const left = Math.max(b.left, camera) + gutter;
  const top = b.top + gutter;
  return {
    x: g.screen.x + left,
    y: g.screen.y + top,
    width: Math.max(0, g.screen.width - left - b.right - gutter),
    height: Math.max(0, g.screen.height - top - b.bottom - gutter),
  };
}

/** Whether the device has system bars to show (a phone, a tablet, the watch). */
export function deviceHasSystemBars(device: WireframeDeviceId): boolean {
  return WIREFRAME_DEVICES[device].deviceClass !== 'computer';
}

/** A rounded rectangle's outline as SVG path data (radii clockwise from the top-left), each
 *  radius kept to half the shorter side. */
export function roundedRectPath(r: Rect, radii: CornerRadii): string {
  const max = Math.min(r.width, r.height) / 2;
  const [tl, tr, br, bl] = radii.map((v) => Math.max(0, Math.min(v, max)));
  const x2 = r.x + r.width;
  const y2 = r.y + r.height;
  const n = (v: number) => Math.round(v * 100) / 100;
  const arc = (rad: number, x: number, y: number) =>
    rad > 0 ? `A${n(rad)} ${n(rad)} 0 0 1 ${n(x)} ${n(y)}` : `L${n(x)} ${n(y)}`;
  return (
    `M${n(r.x + tl!)} ${n(r.y)}H${n(x2 - tr!)}${arc(tr!, x2, r.y + tr!)}` +
    `V${n(y2 - br!)}${arc(br!, x2 - br!, y2)}H${n(r.x + bl!)}${arc(bl!, r.x, y2 - bl!)}` +
    `V${n(r.y + tl!)}${arc(tl!, r.x + tl!, r.y)}Z`
  );
}

/** The screen's outline as SVG path data, at the page's top-left (`ox`, `oy`). */
export function deviceScreenPath(g: DeviceGeometry, ox = 0, oy = 0): string {
  return roundedRectPath({ ...g.screen, x: g.screen.x + ox, y: g.screen.y + oy }, g.radii);
}

/** A browser page's address (docs/specs/007-editor/wireframe-pages.md "Browser toolbar"): the
 *  page's name in lower case with dashes after the domain, or the domain alone. */
export function wireframeAddress(name: string | undefined): string {
  const slug = (name ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return slug ? `example.com/${slug}` : 'example.com';
}
