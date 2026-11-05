// The tools the Explorer page imports from (docs/specs/013-workspace/folders.md "Import from"):
// one entry per SHIPPED source, in the order the header shows them. A new source is one entry.
// The Microsoft Whiteboard and draw.io imports are gone from livehuddle (Work Tracker #423, part 4), so
// `?source=` naming either is an unknown source and the page goes back to the Explorer.
import type { ReactNode } from 'react';
import { ExcalidrawSourceIcon } from '@liveworkspace/explorer/imports';

export type ImportSourceId = 'excalidraw';

export type ImportSource = { id: ImportSourceId; name: string; icon: ReactNode };

export const IMPORT_SOURCES: readonly ImportSource[] = [
  { id: 'excalidraw', name: 'Excalidraw', icon: <ExcalidrawSourceIcon /> },
];
