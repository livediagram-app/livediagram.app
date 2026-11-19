// The Tab Style Finish and Text panels' preview (docs/specs/011-theme/canvas-and-theme-dialog.md "One dialog, this
// editor's profile"): a small room, the scene a look's card draws (lib/look-preview.ts: a room with its door, a desk,
// a plant and a sticky), on a slice of the tab's floor, in the tab's theme, finish, font and the size new text takes,
// drawn by the image exporter so it is what the Space will show. Its floor's pattern id is its own, so it never meets
// a look card's.
import type { BackgroundPattern, Element, Finish, Tab, TextSize } from '@livehuddle/document';
import { renderTabToSvg } from '@/lib/export-tab';
import { lookPreviewScene } from '@/lib/look-preview';
import { withThemeApplied } from '@/lib/tab-theme-apply';

const EXPORT_PATTERN_ID = 'lvd-export-bg';
const PREVIEW_PATTERN_ID = 'lvd-room-preview-bg';

export type RoomPreviewTab = {
  background: string;
  theme: string;
  font?: string | undefined;
  textSize?: TextSize | undefined;
  // The tab's floor, its strength and colour; no floor when unset.
  floor?: BackgroundPattern | undefined;
  floorOpacity?: number | undefined;
  patternColor?: string | undefined;
};

/** The room drawn in `finish` on the tab's floor, as SVG markup. */
export function roomPreviewSvg(finish: Finish, tab: RoomPreviewTab): string {
  const scene = lookPreviewScene();
  const sample = tab.textSize
    ? scene.map((el) => (el.type === 'shape' || el.type === 'sticky' ? { ...el, textSize: tab.textSize } : el) as Element)
    : scene;
  const themed = withThemeApplied({ id: 'room-preview', name: '', elements: sample }, tab.theme);
  const previewTab = {
    ...themed,
    name: 'Room preview',
    finish,
    backgroundColor: tab.background,
    ...(tab.floor ? { backgroundPattern: tab.floor } : {}),
    ...(tab.floorOpacity !== undefined ? { backgroundOpacity: tab.floorOpacity } : {}),
    ...(tab.patternColor ? { patternColor: tab.patternColor } : {}),
    ...(tab.font ? { font: tab.font } : {}),
  } as Tab;
  return renderTabToSvg(previewTab).split(EXPORT_PATTERN_ID).join(PREVIEW_PATTERN_ID);
}
