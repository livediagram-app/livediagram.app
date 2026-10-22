// docs/specs/008-canvas/layout-cleanup.md "Where it shows" and "Share roles": the Tidy Up button is Diagram
// mode's, on a desktop and a phone alike, out of Zen, and only for a session the editor handed actions to (an Editor's).

import { describe, expect, it } from 'vitest';
import { tidyUpOffered, type TidyUpActions } from './tidy-up-actions';

const actions: TidyUpActions = {
  run: () => {},
  preview: () => {},
  endPreview: () => {},
  assess: () => ({ kind: 'ok' }),
  blocked: false,
};
const base = { actions, editorMode: 'diagram' as const, zenMode: false };

describe('tidyUpOffered', () => {
  it('offers the button to an Editor in Diagram mode on a desktop', () => {
    expect(tidyUpOffered(base)).toBe(true);
  });

  it('offers it on a locked tab too, where the popover shows the tidiers inert', () => {
    expect(tidyUpOffered({ ...base, actions: { ...actions, blocked: true } })).toBe(true);
  });

  it('offers nothing to a Participant, a Viewer or an embed, which get no actions', () => {
    expect(tidyUpOffered({ ...base, actions: undefined })).toBe(false);
  });

  it.each(['draw', 'workshop', 'plan'] as const)('is not in %s mode', (editorMode) => {
    expect(tidyUpOffered({ ...base, editorMode })).toBe(false);
  });

  it('is not in Zen', () => {
    expect(tidyUpOffered({ ...base, zenMode: true })).toBe(false);
  });
});
