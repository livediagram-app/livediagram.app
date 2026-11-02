// Inspect's Export (docs/specs/007-editor/wireframe-pages.md "The Inspect panel"): one element, with what sits within
// it, as a picture on a clear ground cut to its own box, at 1x, 2x or 3x. Through the tab exporters, so the picture
// is drawn exactly as the Export dialog draws it; only the scope (this element), the ground and the padding differ.
import {
  containerContents,
  withAttached,
  type BoxedElement,
  type CanvasSurface,
  type Tab,
} from '@livedesign/design';
import { ensureIconCatalogs } from '@liveworkspace/workbench/lib/icon-registry';
import { downloadBlob, exportTabAsPng, exportTabAsSvg, loadTabImages } from './export-tab';
import { sanitizeFilename } from './export-pages';

export type InspectExportFormat = 'png' | 'svg';
export const INSPECT_EXPORT_SCALES = [1, 2, 3] as const;
export type InspectExportScale = (typeof INSPECT_EXPORT_SCALES)[number];

export type InspectImageContext = { ownerId: string; designId: string; shareCode: string | null };

/** The tab cut down to the element and what it holds (a card's contents, a host's badges), in tab order. */
export function inspectExportTab(tab: Tab, el: BoxedElement): Tab {
  const ids = withAttached(tab.elements, containerContents(tab.elements, new Set([el.id])));
  return { ...tab, elements: tab.elements.filter((e) => ids.has(e.id)) };
}

/** `<design> - <element>@<n>x.<ext>`, safe as a file name. */
export function inspectExportName(
  designName: string,
  elementName: string,
  scale: InspectExportScale,
  format: InspectExportFormat,
): string {
  return `${sanitizeFilename(`${designName || 'design'} - ${elementName || 'element'}`)}@${scale}x.${format}`;
}

export async function exportInspectedElement(input: {
  tab: Tab;
  el: BoxedElement;
  format: InspectExportFormat;
  scale: InspectExportScale;
  surface: CanvasSurface;
  fileName: string;
  imageContext?: InspectImageContext;
}): Promise<void> {
  const tab = inspectExportTab(input.tab, input.el);
  await ensureIconCatalogs();
  const images = input.imageContext ? await loadTabImages(tab, input.imageContext) : undefined;
  const opts = {
    images,
    scale: input.scale,
    padding: 0,
    transparent: true,
    pattern: false,
    surface: input.surface,
  };
  const blob =
    input.format === 'png' ? await exportTabAsPng(tab, opts) : await exportTabAsSvg(tab, opts);
  downloadBlob(blob, input.fileName);
}
