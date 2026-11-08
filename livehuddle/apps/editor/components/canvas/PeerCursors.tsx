'use client';

import { RemoteCursors } from '@liveworkspace/workbench/components/canvas/RemoteCursor';
import { identityVars } from '@livehuddle/ui';
import { usePeerCursorRows } from '@/hooks/collab/usePeerRows';
import type { PeerRowsSource } from '@/lib/peer-motion';

// Peers' cursors on the active tab: the one part of the element layer that subscribes to their movement, so a frame
// of it renders this and nothing around it (docs/specs/008-canvas/canvas-performance.md "A collaborator moving
// renders what shows them, not the editor").
export function PeerCursors({ peers }: { peers: PeerRowsSource }) {
  return <RemoteCursors cursors={usePeerCursorRows(peers)} paint={identityVars} />;
}
