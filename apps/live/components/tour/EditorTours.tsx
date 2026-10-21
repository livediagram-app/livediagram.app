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
// The Forms tour (docs/specs/030-forms/forms.md "The Forms tour"): the first time an Editor opens a Form tab.
const FormTourHost = dynamic(
  () => import('@/components/tour/FormTourHost').then((m) => m.FormTourHost),
  { ssr: false },
);
// The Draw tour (docs/specs/023-draw-mode/draw-tour.md): the same, the first time the person enters Draw.
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
// The Pages tour (docs/specs/007-editor/pages-tour.md): the same, the first time the person enters
// Pages.
const PagesTourHost = dynamic(
  () => import('@/components/tour/PagesTourHost').then((m) => m.PagesTourHost),
  { ssr: false },
);

// The editor's tours (docs/specs/007-editor/editor-tour.md), each mounted the first time its mode or kind is
// worked in and kept mounted after, so leaving mid-tour still runs its clean-up.
export function EditorTours() {
  const { editorMode, activeTab } = useEditorContext();
  const mountPlanTour = useEverTrue(editorMode.mode === 'plan');
  const mountDrawTour = useEverTrue(editorMode.mode === 'draw');
  const mountFormTour = useEverTrue(activeTab.kind === 'form');
  const mountPagesTour = useEverTrue(editorMode.mode === 'pages');
  return (
    <>
      <TourHost />
      {/* The Plan tour (docs/specs/026-plan/plan-tour.md): the first time a person works in Plan. */}
      {mountPlanTour ? <PlanTourHost /> : null}
      {mountDrawTour ? <DrawTourHost /> : null}
      {/* The Forms tour (docs/specs/030-forms/forms.md "The Forms tour"): the first time an Editor opens a Form tab. */}
      {mountFormTour ? <FormTourHost /> : null}
      {/* A form template's form, started once its tab opens (lib/pending-form-start.ts). */}
      <PendingFormStart />
      {mountPagesTour ? <PagesTourHost /> : null}
      <ElementTourHost />
    </>
  );
}
