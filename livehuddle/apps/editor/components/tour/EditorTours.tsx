'use client';

import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { useEverTrue } from '@liveworkspace/workbench/hooks/ui/useEverTrue';

// Element tours (docs/specs/007-editor/element-tours.md): offered beside the selection toolbar of a toured element
// kind, so mounted with the editor. The Receptionist (docs/specs/008-canvas/receptionist.md), who replaced the Avatar
// tour: the footer's Ask Receptionist and your welcome. The one guide of a Space
// (docs/specs/012-collaboration/workshop-mode.md "Help"): there is no Workshop tour. His canvas layer draws him; this
// host knows the person. Both chunks stay out of the first load, and are in before a warm paint
// (lib/editor-deferred-code.ts).
import { ElementTourHost, ReceptionistHost } from '@/lib/editor-deferred-code';

// The editor's tours (docs/specs/007-editor/editor-tour.md), each mounted the first time it could be taken and kept
// mounted after, so leaving mid-tour still runs its clean-up.
export function EditorTours() {
  const { canvasTool } = useEditorContext();
  const mountReceptionist = useEverTrue(canvasTool === 'avatar');
  return (
    <>
      {/* The Receptionist (docs/specs/008-canvas/receptionist.md): mounted the first time a person walks, as he is only seen walking. */}
      {mountReceptionist ? <ReceptionistHost /> : null}
      <ElementTourHost />
    </>
  );
}
