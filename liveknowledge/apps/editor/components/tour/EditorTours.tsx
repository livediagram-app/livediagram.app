'use client';

// Element tours (docs/specs/007-editor/element-tours.md): offered beside the selection toolbar of a toured element
// kind, so mounted with the editor. The Pages tour (docs/specs/007-editor/pages-tour.md): offered the first time the
// person works on each kind of page. Both chunks stay out of the first load, and are in before a warm paint
// (lib/editor-deferred-code.ts).
import { ElementTourHost, PagesTourHost } from '@/lib/editor-deferred-code';

// The editor's tours (docs/specs/007-editor/pages-tour.md), mounted with the editor so leaving mid-tour still
// runs their clean-up.
export function EditorTours() {
  return (
    <>
      <PagesTourHost />
      <ElementTourHost />
    </>
  );
}
