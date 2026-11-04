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
// The Avatar tour (docs/specs/008-canvas/avatar-tour.md): the first time the person walks as an avatar. It is the one
// guided tour of a Space (docs/specs/012-collaboration/workshop-mode.md "Help"): there is no Workshop tour.
const AvatarTourHost = dynamic(
  () => import('@/components/tour/AvatarTourHost').then((m) => m.AvatarTourHost),
  { ssr: false },
);

// The editor's tours (docs/specs/007-editor/editor-tour.md), each mounted the first time it could be taken and kept
// mounted after, so leaving mid-tour still runs its clean-up.
export function EditorTours() {
  const { canvasTool } = useEditorContext();
  const mountAvatarTour = useEverTrue(canvasTool === 'avatar');
  return (
    <>
      {/* The Avatar tour (docs/specs/008-canvas/avatar-tour.md): the first time a person walks as an avatar. */}
      {mountAvatarTour ? <AvatarTourHost /> : null}
      <ElementTourHost />
    </>
  );
}
