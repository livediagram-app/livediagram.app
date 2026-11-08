'use client';

import dynamic from 'next/dynamic';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { useEverTrue } from '@liveworkspace/workbench/hooks/ui/useEverTrue';

// Element tours (docs/specs/007-editor/element-tours.md): offered beside the selection toolbar of a toured element
// kind, so mounted with the editor; its chunk stays out of the first load.
const ElementTourHost = dynamic(
  () => import('@/components/tour/ElementTourHost').then((m) => m.ElementTourHost),
  { ssr: false },
);
// The Receptionist (docs/specs/008-canvas/receptionist.md), who replaced the Avatar tour: the footer's Ask Receptionist and
// your welcome. The one guide of a Space (docs/specs/012-collaboration/workshop-mode.md "Help"): there is no Workshop
// tour. His canvas layer draws him; this host knows the person.
const ReceptionistHost = dynamic(
  () => import('@/components/tour/ReceptionistHost').then((m) => m.ReceptionistHost),
  {
    ssr: false,
  },
);

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
