'use client';

import { useState } from 'react';
import { untitledNameForTemplate, type TemplateKind } from '@livediagram/templates';
import { isOfflineLocation } from '@/lib/save-locations';
import { skipPlacementSent, type SkipLocationStep } from '@/lib/skip-location-step';
import type { NewDocumentSettings } from './TemplatePicker';

// The New Document wizard's side of skipping the Location step
// (docs/specs/013-workspace/default-folders.md "Skipping the Location step"): whether this visit
// is one step, what a create then sends, and the Location step's "Always save new documents in
// <place> and skip this step" checkbox.
export function useWizardSkipLocation({
  place,
  enabled,
}: {
  /** Where to save without asking (resolved by the page), or null for the two steps. */
  place: SkipLocationStep | null | undefined;
  /** Only the welcome wizard has a Location step to skip. */
  enabled: boolean;
}) {
  // Once the Location step has shown (Change, the rail, a fallback), the visit stays two steps:
  // a preference that lands mid-visit never pulls the step away from under the reader.
  const [locationShown, setLocationShown] = useState(false);
  const [ticked, setTicked] = useState(false);
  const active = enabled && !!place && !locationShown;
  return {
    /** The saved place while the wizard is one step, else null. */
    place: active ? place! : null,
    ticked,
    setTicked,
    /** The Location step is showing: the checkbox starts unticked, the visit is two steps. */
    onLocationShown: () => {
      setLocationShown(true);
      setTicked(false);
    },
    /** What a one-step create sends: the saved place, explicitly, and the template's name. */
    settingsFor: (saved: SkipLocationStep, kind: TemplateKind): NewDocumentSettings => ({
      saveLocation: saved.saveLocation,
      documentName: untitledNameForTemplate(kind),
      ...(isOfflineLocation(saved.saveLocation) ? {} : skipPlacementSent(saved)),
    }),
  };
}
