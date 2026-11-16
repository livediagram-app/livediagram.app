'use client';

import { WatchItBuiltHost } from '@/components/tour/WatchItBuiltHost';
// Element tours (docs/specs/007-editor/element-tours.md): offered beside the selection toolbar of a toured element
// kind, so mounted with the editor; its chunk stays out of the first load, and is in before a warm paint
// (lib/editor-deferred-code.ts).
import { ElementTourHost } from '@/lib/editor-deferred-code';

// The editor's tours (docs/specs/007-editor/editor-tour.md), each mounted the first time its mode or kind is
// worked in and kept mounted after, so leaving mid-tour still runs its clean-up.
export function EditorTours() {
  return (
    <>
      {/* Diagram, Draw and Workshop's tour, Watch It Built (docs/specs/007-editor/watch-it-built.md). */}
      <WatchItBuiltHost />
      <ElementTourHost />
    </>
  );
}
