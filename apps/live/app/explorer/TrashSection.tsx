'use client';

// The Explorer's Trash route body (docs/specs/013-workspace/trash.md): wires
// the Trash state to the Explorer's owner, toasts and list refresh, so a
// restored document shows up in its folder without a reload.
import { TrashPane } from '@/components/panels/TrashPane';
import { useTrash } from '@/hooks/persistence/useTrash';
import { useToast } from '@/hooks/ui/useToast';
import { useExplorer } from './ExplorerContext';

export function TrashSection() {
  const { ownerId, refreshLibraries } = useExplorer();
  const toast = useToast();
  const trash = useTrash(ownerId, toast, refreshLibraries);
  return <TrashPane trash={trash} />;
}
