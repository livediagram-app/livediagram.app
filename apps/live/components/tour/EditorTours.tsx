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
// The Facilitate tour (docs/specs/012-collaboration/facilitate-tour.md) loads the first time the person
// enters Facilitate, and stays mounted after, as the Plan tour does.
const FacilitateTourHost = dynamic(
  () => import('@/components/tour/FacilitateTourHost').then((m) => m.FacilitateTourHost),
  { ssr: false },
);
// The Forms tour (docs/specs/030-forms/forms.md "The Forms tour"): the first time an Editor opens a Form tab.
const FormTourHost = dynamic(
  () => import('@/components/tour/FormTourHost').then((m) => m.FormTourHost),
  { ssr: false },
);
// The Drawing tour (docs/specs/023-drawing-mode/drawing-tour.md): the same, the first time the person enters Drawing.
const DrawTourHost = dynamic(
  () => import('@/components/tour/DrawTourHost').then((m) => m.DrawTourHost),
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
// The Illustrate tour (docs/specs/007-editor/illustrate-tour.md): the same, the first time the person enters
// Illustrate.
const IllustrateTourHost = dynamic(
  () => import('@/components/tour/IllustrateTourHost').then((m) => m.IllustrateTourHost),
  { ssr: false },
);

// The editor's tours (docs/specs/007-editor/editor-tour.md), each mounted the first time its mode or kind is
// worked in and kept mounted after, so leaving mid-tour still runs its clean-up.
export function EditorTours() {
  const { editorMode, activeTab, canvasTool } = useEditorContext();
  const mountPlanTour = useEverTrue(editorMode.mode === 'plan');
  const mountFacilitateTour = useEverTrue(editorMode.mode === 'facilitate');
  const mountDrawTour = useEverTrue(editorMode.mode === 'draw');
  const mountFormTour = useEverTrue(activeTab.kind === 'form');
  const mountAvatarTour = useEverTrue(canvasTool === 'avatar');
  const mountIllustrateTour = useEverTrue(editorMode.mode === 'illustrate');
  return (
    <>
      <TourHost />
      {/* The Plan tour (docs/specs/026-plan/plan-tour.md): the first time a person works in Plan. */}
      {mountPlanTour ? <PlanTourHost /> : null}
      {/* The Facilitate tour (docs/specs/012-collaboration/facilitate-tour.md): the first time a person works in Facilitate. */}
      {mountFacilitateTour ? <FacilitateTourHost /> : null}
      {mountDrawTour ? <DrawTourHost /> : null}
      {/* The Forms tour (docs/specs/030-forms/forms.md "The Forms tour"): the first time an Editor opens a Form tab. */}
      {mountFormTour ? <FormTourHost /> : null}
      {/* A form template's form, started once its tab opens (lib/pending-form-start.ts). */}
      <PendingFormStart />
      {/* The Avatar tour (docs/specs/008-canvas/avatar-tour.md): the first time a person walks as an avatar. */}
      {mountAvatarTour ? <AvatarTourHost /> : null}
      {mountIllustrateTour ? <IllustrateTourHost /> : null}
      <ElementTourHost />
    </>
  );
}
