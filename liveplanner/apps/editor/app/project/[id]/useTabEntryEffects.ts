// The side effects of landing on a tab (@liveworkspace/workbench/hooks/editor/useTabEntryEffects): the `#t=` pin and
// the fit once per entry, the warm-painted tab's included (docs/specs/006-project/offline-mode.md "Warm open of a
// cloud project"), bound to this editor's addresses. The pin keeps an opened card's mark on its entry (useCardAddress),
// so closing the card still steps back off it.
import { createTabEntryEffects } from '@liveworkspace/workbench/hooks/editor/useTabEntryEffects';
import { isEditorPath } from '@/lib/editor-path';
import { cardEntryState, isCardEntry } from '@/lib/card-address';

export const useTabEntryEffects = createTabEntryEffects(isEditorPath, () =>
  cardEntryState(isCardEntry(window.history.state)),
);
