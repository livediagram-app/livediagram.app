import { describe, expect, it } from 'vitest';
import {
  WIREFRAME_DEVICE_IDS,
  WIREFRAME_DEVICES,
  deviceGeometry,
  deviceSafeArea,
  deviceScreenPath,
  wireframeAddress,
} from './wireframe-device';
import {
  layOutPages,
  pageLabel,
  pagesOf,
  pageDimensions,
  pageHasOrientation,
  newWireframePage,
  type Page,
} from './page';
import { pageClipPathData, pageContentBox, pageScreenRect } from './wireframe-page';
import { pageDeviceSet, pageAdded, pageAddedLike } from './pages-edits';
import { wireframeFrameSvg } from './wireframe-page';
import { pageExportFrame } from './page-frame';

const inside = (
  inner: { x: number; y: number; width: number; height: number },
  outer: { x: number; y: number; width: number; height: number },
) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

describe('wireframe devices', () => {
  it.each(WIREFRAME_DEVICE_IDS)('%s: its screen is its real size, inside its frame', (id) => {
    const g = deviceGeometry(id);
    expect(g.screen.width).toBe(WIREFRAME_DEVICES[id].screen.width);
    expect(g.screen.height).toBe(WIREFRAME_DEVICES[id].screen.height);
    expect(inside(g.screen, { x: 0, y: 0, width: g.width, height: g.height })).toBe(true);
    expect(inside(deviceSafeArea(g, true), g.screen)).toBe(true);
  });

  it('turns a phone or tablet, never a computer or the watch', () => {
    const g = deviceGeometry('iphone', true);
    expect(g.landscape).toBe(true);
    expect([g.width, g.height]).toEqual([
      deviceGeometry('iphone').height,
      deviceGeometry('iphone').width,
    ]);
    expect(g.screen.width).toBe(852);
    expect(g.bars.top).toBe(0);
    expect(deviceGeometry('laptop', true).landscape).toBe(false);
    expect(deviceGeometry('watch', true).landscape).toBe(false);
  });

  it('opens the iPhone Duo to one screen, 890 x 626 held landscape, its bars kept', () => {
    const open = deviceGeometry('iphone-duo', true);
    expect([open.screen.width, open.screen.height]).toEqual([890, 626]);
    expect(open.bars.top).toBeGreaterThan(0);
    expect(deviceScreenPath(open).match(/M/g)).toHaveLength(1);
    // A new Duo page starts opened; the iPhone upright.
    expect(newWireframePage('a', 'iphone-duo').orientation).toBe('landscape');
    expect(newWireframePage('b', 'iphone').orientation).toBe('portrait');
  });

  it('names a browser page by its address', () => {
    expect(wireframeAddress(undefined)).toBe('example.com');
    expect(wireframeAddress('Pricing & Plans')).toBe('example.com/pricing-plans');
    expect(wireframeAddress('Café')).toBe('example.com/cafe');
  });
});

describe('wireframe pages', () => {
  const tab = (pages: Page[]) => ({ elements: [], pages });
  const kinds = (t: { pages?: unknown }) => pagesOf(t);

  it('reads a stored page as its device, an unknown one as the iPhone', () => {
    const [p] = pagesOf(
      tab([
        {
          id: 'a',
          orientation: 'landscape',
          kind: 'wireframe',
          device: 'laptop',
          frameLook: 'outline',
        },
      ]),
    );
    expect(p).toMatchObject({
      kind: 'wireframe',
      device: 'laptop',
      size: 'device',
      orientation: 'portrait',
      frameLook: 'outline',
    });
    // A stored page from a newer build: its device and look unknown here.
    const [q] = pagesOf(
      tab([
        {
          id: 'b',
          orientation: 'portrait',
          kind: 'wireframe',
          device: 'flip-phone',
          frameLook: 'neon',
        } as unknown as Page,
      ]),
    );
    expect(q).toMatchObject({ device: 'iphone' });
    expect(q!.frameLook).toBeUndefined();
    expect(pageDimensions(q!)).toEqual({ width: 423, height: 876 });
    expect(pageHasOrientation(q!)).toBe(true);
    expect(pageLabel({ ...q!, orientation: 'landscape' }, 0, 1)).toBe(
      'iPhone · Landscape · Wireframe',
    );
  });

  it('puts content on the screen and its safe area, and clips to the screen', () => {
    const [page] = layOutPages(
      pagesOf(tab([{ id: 'a', orientation: 'portrait', kind: 'wireframe', device: 'ipad' }])),
    );
    const screen = pageScreenRect(page!);
    expect(inside(screen, page!.rect)).toBe(true);
    expect(inside(pageContentBox(page!), screen)).toBe(true);
    expect(pageClipPathData(page!)).toMatch(/^M/);
  });

  it('draws its frame, and exports see-through round the device with its content clipped', () => {
    const [page] = layOutPages(
      pagesOf(
        tab([
          { id: 'a', orientation: 'portrait', kind: 'wireframe', device: 'browser', name: 'Docs' },
        ]),
      ),
    );
    const svg = wireframeFrameSvg(page!, { dark: false })!;
    expect(svg.under).toContain('example.com/docs');
    const frame = pageExportFrame(page!);
    expect(frame.transparent).toBe(true);
    expect(frame.clipPath).toBeTruthy();
    expect(frame.backgroundSvg).toContain('clip-path');
  });

  it('adds a wireframe page in the device chosen, else the last one', () => {
    const one = pageAdded(tab([{ id: 'a', orientation: 'portrait' }]), 'wireframe', 'b', 'watch');
    expect('tab' in one && kinds(one.tab).at(-1)).toMatchObject({
      kind: 'wireframe',
      device: 'watch',
    });
    const two = 'tab' in one ? pageAdded(one.tab, 'wireframe', 'c') : one;
    expect('tab' in two && kinds(two.tab).at(-1)).toMatchObject({ device: 'watch' });
  });

  it('changes its turn, look and bars, never its device; refuses any other page', () => {
    const t = tab([{ id: 'a', orientation: 'landscape', kind: 'wireframe', device: 'iphone' }]);
    const out = pageDeviceSet(t, 'a', {
      frameLook: 'light',
      systemBars: false,
      orientation: 'portrait',
    });
    expect('tab' in out && kinds(out.tab)[0]).toMatchObject({
      device: 'iphone',
      orientation: 'portrait',
      frameLook: 'light',
      systemBars: false,
    });
    // A device that never turns stays upright.
    const laptop = tab([{ id: 'l', orientation: 'portrait', kind: 'wireframe', device: 'laptop' }]);
    expect(pageDeviceSet(laptop, 'l', { orientation: 'landscape' })).toEqual({ tab: laptop });
    expect(pageDeviceSet(t, 'a', {})).toEqual({ tab: t });
    expect(
      pageDeviceSet(tab([{ id: 'x', orientation: 'portrait' }]), 'x', { frameLook: 'dark' }),
    ).toEqual({ refused: 'not_a_wireframe' });
  });

  it('adds another page like a page: its kind and shape, a wireframe its device and frame too', () => {
    const t = tab([
      { id: 'a', orientation: 'landscape', size: 'a3' },
      {
        id: 'w',
        orientation: 'landscape',
        kind: 'wireframe',
        device: 'iphone-duo',
        frameLook: 'outline',
        systemBars: false,
      },
    ]);
    const w = pageAddedLike(t, 'w', 'n');
    expect('tab' in w && kinds(w.tab).at(-1)).toMatchObject({
      id: 'n',
      kind: 'wireframe',
      device: 'iphone-duo',
      frameLook: 'outline',
      orientation: 'landscape',
      systemBars: false,
    });
    const a = pageAddedLike(t, 'a', 'm');
    expect('tab' in a && kinds(a.tab).at(-1)).toMatchObject({
      size: 'a3',
      orientation: 'landscape',
    });
    expect(pageAddedLike(t, 'nope', 'x')).toEqual({ refused: 'unknown_page' });
  });
});
