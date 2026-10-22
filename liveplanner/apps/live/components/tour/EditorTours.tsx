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

// The editor's tours (docs/specs/007-editor/editor-tour.md): the Plan tour with the editor, the others each mounted the
// first time their kind is worked in and kept mounted after, so leaving mid-tour still runs its clean-up.
export function EditorTours() {
  const { activeTab } = useEditorContext();
  const mountFormTour = useEverTrue(activeTab.kind === 'form');
  return (
    <>
      {/* The Plan tour (docs/specs/026-plan/plan-tour.md): offered once a board or Sheet is on the tab. */}
      <PlanTourHost />
      {/* The Forms tour (docs/specs/030-forms/forms.md "The Forms tour"): the first time an Editor opens a Form tab. */}
      {mountFormTour ? <FormTourHost /> : null}
      {/* A form template's form, started once its tab opens (lib/pending-form-start.ts). */}
      <PendingFormStart />
    </>
  );
}
