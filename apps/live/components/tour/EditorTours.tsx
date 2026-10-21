'use client';

import dynamic from 'next/dynamic';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { PendingFormStart } from '@/components/forms/PendingFormStart';
import { TourHost } from '@/components/tour/TourHost';
import { useEverTrue } from '@/hooks/ui/useEverTrue';

// The Plan tour (docs/specs/026-plan/plan-tour.md) loads the first time the person enters Plan, and stays
// mounted after, so leaving Plan mid-tour still runs its clean-up.
const PlanTourHost = dynamic(
  () => import('@/components/tour/PlanTourHost').then((m) => m.PlanTourHost),
  { ssr: false },
);
// The Workshop tour (docs/specs/012-collaboration/workshop-tour.md) loads the first time the person
// enters Workshop, and stays mounted after, as the Plan tour does.
const WorkshopTourHost = dynamic(
  () => import('@/components/tour/WorkshopTourHost').then((m) => m.WorkshopTourHost),
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
// The Pages tour (docs/specs/007-editor/pages-tour.md): the same, the first time the person enters
// Pages.
const PagesTourHost = dynamic(
  () => import('@/components/tour/PagesTourHost').then((m) => m.PagesTourHost),
  { ssr: false },
);

// The editor's tours (docs/specs/007-editor/editor-tour.md), each mounted the first time its mode or kind is
// worked in and kept mounted after, so leaving mid-tour still runs its clean-up.
export function EditorTours() {
  const { editorMode, activeTab, canvasTool } = useEditorContext();
  const mountPlanTour = useEverTrue(editorMode.mode === 'plan');
  const mountWorkshopTour = useEverTrue(editorMode.mode === 'workshop');
  const mountFormTour = useEverTrue(activeTab.kind === 'form');
  const mountAvatarTour = useEverTrue(canvasTool === 'avatar');
  const mountPagesTour = useEverTrue(editorMode.mode === 'pages');
  return (
    <>
      <TourHost />
      {/* The Plan tour (docs/specs/026-plan/plan-tour.md): the first time a person works in Plan. */}
      {mountPlanTour ? <PlanTourHost /> : null}
      {/* The Workshop tour (docs/specs/012-collaboration/workshop-tour.md): the first time a person works in Workshop. */}
      {mountWorkshopTour ? <WorkshopTourHost /> : null}
      {/* The Forms tour (docs/specs/030-forms/forms.md "The Forms tour"): the first time an Editor opens a Form tab. */}
      {mountFormTour ? <FormTourHost /> : null}
      {/* A form template's form, started once its tab opens (lib/pending-form-start.ts). */}
      <PendingFormStart />
      {/* The Avatar tour (docs/specs/008-canvas/avatar-tour.md): the first time a person walks as an avatar. */}
      {mountAvatarTour ? <AvatarTourHost /> : null}
      {mountPagesTour ? <PagesTourHost /> : null}
      <ElementTourHost />
    </>
  );
}
