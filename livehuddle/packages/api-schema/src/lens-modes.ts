// The Explorer filter lens's Mode values (docs/specs/013-workspace/explorer-filters.md "Dimensions"): every editor
// mode a canvas can open in, with the name the interface shows, matched against the mode the canvas's room reports
// to the index (`summary.mode`). The one list of modes, so a new mode is filterable unasked. Both Explorers bind it:
// the editor's (`lensModes`) and liveworkspace.app's on livehuddle's address.

import { EDITOR_MODE_CATALOGUE } from '@livehuddle/document';

export const LENS_MODES: readonly { value: string; label: string }[] = EDITOR_MODE_CATALOGUE.map(
  (mode) => ({ value: mode.id, label: mode.label }),
);
