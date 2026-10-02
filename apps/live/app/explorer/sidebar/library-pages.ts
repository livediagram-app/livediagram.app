import { ImageIcon, PaletteIcon, ShapesIcon } from '@/components/primitives/explorer-icons';
import type { SelectedNode } from '../views';
import { SIDEBAR_LABELS } from './sidebar-structure';
import type { SidebarTelemetryRow } from './sidebar-telemetry';

// The Library's pages, in order (docs/specs/013-workspace/explorer-structure.md#more): one list
// for the sidebar and the editor's Explorer panel.
export const LIBRARY_PAGES = [
  { kind: 'gallery', label: SIDEBAR_LABELS.gallery, Icon: ImageIcon, row: 'ImageGallery' },
  { kind: 'themes', label: SIDEBAR_LABELS.themes, Icon: PaletteIcon, row: 'Themes' },
  {
    kind: 'shape-libraries',
    label: SIDEBAR_LABELS.shapeLibraries,
    Icon: ShapesIcon,
    row: 'ShapeLibraries',
  },
] as const satisfies readonly {
  kind: SelectedNode['kind'];
  label: string;
  Icon: unknown;
  row: SidebarTelemetryRow;
}[];
