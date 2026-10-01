// The tools the Explorer page imports from (docs/specs/013-workspace/folders.md "Import from"):
// one entry per SHIPPED source, in the order the header shows them. A new source is one entry.
import type { ReactNode } from 'react';
import {
  ExcalidrawSourceIcon,
  MsWhiteboardSourceIcon,
} from '@/components/dialogs/import-source-icons';

export type ImportSourceId = 'microsoft-whiteboard' | 'excalidraw';

export type ImportSource = { id: ImportSourceId; name: string; icon: ReactNode };

export const IMPORT_SOURCES: readonly ImportSource[] = [
  { id: 'microsoft-whiteboard', name: 'Microsoft Whiteboard', icon: <MsWhiteboardSourceIcon /> },
  { id: 'excalidraw', name: 'Excalidraw', icon: <ExcalidrawSourceIcon /> },
];
