'use client';

import dynamic from 'next/dynamic';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { PendingFormStart } from '@/components/forms/PendingFormStart';
import { useEverTrue } from '@/hooks/ui/useEverTrue';

// The Plan tour (docs/specs/026-plan/plan-tour.md), its chunk out of the editor's first load.
const PlanTourHost = dynamic(
  () => import('@/components/tour/PlanTourHost').then((m) => m.PlanTourHost),
  { ssr: false },
);
// The Forms tour (docs/specs/030-forms/forms.md "The Forms tour"): the first time an Editor opens a Form tab.
const FormTourHost = dynamic(
  () => import('@/components/tour/FormTourHost').then((m) => m.FormTourHost),
  { ssr: false },
);
// Element tours (docs/specs/007-editor/element-tours.md): offered beside the selection toolbar of a toured element
// kind, so mounted with the editor; its chunk stays out of the first load.
const ElementTourHost = dynamic(
  () => import('@/components/tour/ElementTourHost').then((m) => m.ElementTourHost),
  { ssr: false },
);
// The Avatar tour (docs/specs/008-canvas/avatar-tour.md): the same, the first time the person walks as an avatar.
const AvatarTourHost = dynamic(
  () => import('@/components/tour/AvatarTourHost').then((m) => m.AvatarTourHost),
  { ssr: false },
);

// The editor's tours (docs/specs/007-editor/editor-tour.md): the Plan tour with the editor, the others each mounted the
// first time their kind is worked in and kept mounted after, so leaving mid-tour still runs its clean-up.
export function EditorTours() {
  const { activeTab, canvasTool } = useEditorContext();
  const mountFormTour = useEverTrue(activeTab.kind === 'form');
  const mountAvatarTour = useEverTrue(canvasTool === 'avatar');
  return (
    <>
      {/* The Plan tour (docs/specs/026-plan/plan-tour.md): offered once a board or Sheet is on the tab. */}
      <PlanTourHost />
      {/* The Forms tour (docs/specs/030-forms/forms.md "The Forms tour"): the first time an Editor opens a Form tab. */}
      {mountFormTour ? <FormTourHost /> : null}
      {/* A form template's form, started once its tab opens (lib/pending-form-start.ts). */}
      <PendingFormStart />
      {/* The Avatar tour (docs/specs/008-canvas/avatar-tour.md): the first time a person walks as an avatar. */}
      {mountAvatarTour ? <AvatarTourHost /> : null}
      <ElementTourHost />
    </>
  );
}
