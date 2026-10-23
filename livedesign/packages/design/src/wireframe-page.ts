// A wireframe page as a page (docs/specs/007-editor/wireframe-pages.md): its device's geometry
// placed at the page's rect, the screen its content lives on and is clipped to, the safe area
// layouts fill and snapping offers, and its frame as SVG. Every other kind of page answers its own
// rect here, so a caller asks once whatever the kind.
import {
  DEFAULT_WIREFRAME_DEVICE,
  deviceGeometry,
  deviceHasSystemBars,
  deviceSafeArea,
  roundedRectPath,
  WIREFRAME_DEVICES,
  type DeviceGeometry,
  type WireframeDeviceClass,
} from './wireframe-device';
import { canvasSurface } from './colors';
import { isFinish } from './finish';
import { getBuiltInTheme } from './themes';
import {
  wireframeFrameTheme,
  wireframeFrameOverSvg,
  wireframeFrameUnderSvg,
  wireframeScreenPath,
  type WireframeFrameTheme,
} from './wireframe-device-svg';
import { pageMargin, type LaidOutPage, type Page, type PageRect } from './page';

type WireframeLike = Pick<Page, 'kind' | 'device' | 'orientation'>;

export function isWireframePage(page: Pick<Page, 'kind'>): boolean {
  return page.kind === 'wireframe';
}

/** A wireframe page's device geometry (its frame from the page's top-left), else null. */
export function pageDeviceGeometry(page: WireframeLike): DeviceGeometry | null {
  if (page.kind !== 'wireframe') return null;
  return deviceGeometry(page.device ?? DEFAULT_WIREFRAME_DEVICE, page.orientation === 'landscape');
}

/** The device class of a wireframe page, else null. */
export function pageDeviceClass(page: WireframeLike): WireframeDeviceClass | null {
  return page.kind === 'wireframe'
    ? WIREFRAME_DEVICES[page.device ?? DEFAULT_WIREFRAME_DEVICE].deviceClass
    : null;
}

/** Whether the page shows its system bars: a wireframe page whose device has them, unless turned off. */
export function pageShowsSystemBars(page: WireframeLike & Pick<Page, 'systemBars'>): boolean {
  return (
    page.kind === 'wireframe' &&
    page.systemBars !== false &&
    deviceHasSystemBars(page.device ?? DEFAULT_WIREFRAME_DEVICE)
  );
}

/** What the page's content lives on, in canvas px: a wireframe page's screen, any other page's
 *  sheet. */
export function pageScreenRect(page: LaidOutPage): PageRect {
  const g = pageDeviceGeometry(page);
  if (!g) return page.rect;
  return { ...g.screen, x: page.rect.x + g.screen.x, y: page.rect.y + g.screen.y };
}

/** The box a layout fills and snapping offers as the margin, in canvas px: a wireframe page's safe
 *  area, any other page's sheet less its margin. */
export function pageContentBox(
  page: Pick<LaidOutPage, 'rect' | 'orientation' | 'size' | 'fit'> &
    Partial<Pick<Page, 'kind' | 'device' | 'systemBars'>>,
): PageRect {
  const g = page.kind === 'wireframe' ? pageDeviceGeometry(page) : null;
  if (g) {
    const safe = deviceSafeArea(g, pageShowsSystemBars(page));
    return { ...safe, x: page.rect.x + safe.x, y: page.rect.y + safe.y };
  }
  const m = pageMargin(page);
  const { x, y, width, height } = page.rect;
  return { x: x + m, y: y + m, width: width - 2 * m, height: height - 2 * m };
}

/** The page's visible outline as SVG path data in canvas px: what its content is cut off at (a
 *  wireframe page's rounded screen, any other page's sheet). */
export function pageClipPathData(page: LaidOutPage): string {
  const g = pageDeviceGeometry(page);
  if (g) return wireframeScreenPath(g, page.rect.x, page.rect.y);
  return roundedRectPath(page.rect, [0, 0, 0, 0]);
}

export type WireframeFrameSvg = {
  // Under the screen: the device's body, bezel and its parts outside the screen.
  under: string;
  // Over the screen's content: the camera in the screen and the system bars.
  over: string;
  // The screen's outline, what the content is clipped to and the background paints.
  screen: string;
};

/** A wireframe page's frame as SVG in canvas px (`dark`: its screen's background is dark, so the
 *  system bars are white; `theme`: the tab theme's colours, for a frame in the Theme look), else
 *  null. */
export function wireframeFrameSvg(
  page: LaidOutPage,
  { dark, theme }: { dark: boolean; theme?: WireframeFrameTheme },
): WireframeFrameSvg | null {
  const g = pageDeviceGeometry(page);
  if (!g) return null;
  const look = page.frameLook ?? 'theme';
  const { x, y } = page.rect;
  return {
    under: wireframeFrameUnderSvg(g, look, x, y, page.name, theme),
    over: wireframeFrameOverSvg(g, look, x, y, {
      systemBars: pageShowsSystemBars(page),
      dark,
      ...(theme ? { theme } : {}),
    }),
    screen: wireframeScreenPath(g, x, y),
  };
}

/** The tab's style for its wireframe frames (docs/specs/007-editor/wireframe-pages.md): its
 *  theme's colours (the half its canvas is drawn in) and its finish. */
export function tabWireframeFrameTheme(tab: {
  theme?: string;
  backgroundColor?: string;
  finish?: unknown;
}): WireframeFrameTheme {
  const half = getBuiltInTheme(tab.theme, canvasSurface(tab.backgroundColor));
  const finish = isFinish(tab.finish) ? tab.finish : undefined;
  return {
    ...wireframeFrameTheme({
      ...half,
      backgroundColor: tab.backgroundColor ?? half.backgroundColor,
    }),
    // A hand-drawn finish draws the frame by hand too (wireframe-device-svg).
    ...(finish ? { finish } : {}),
  };
}
