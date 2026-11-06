// docs/specs/008-canvas/layout-cleanup.md "Where it shows" and "Share roles": the Tidy Up button shows on a
// desktop and a phone alike, outside an embed, and only for a session the editor handed actions to (an Editor's).

import { describe, expect, it } from 'vitest';
import { tidyUpOffered, type TidyUpActions } from './tidy-up-actions';

const actions: TidyUpActions = {
  run: () => {},
  preview: () => {},
  endPreview: () => {},
  assess: () => ({ kind: 'ok' }),
  blocked: false,
};
const base = { actions, chromeAway: false };

describe('tidyUpOffered', () => {
  it('offers the button to an Editor on a desktop', () => {
    expect(tidyUpOffered(base)).toBe(true);
  });

  it('offers it on a locked tab too, where the popover shows Auto-align inert', () => {
    expect(tidyUpOffered({ ...base, actions: { ...actions, blocked: true } })).toBe(true);
  });

  it('offers nothing to a Participant, a Viewer or an embed, which get no actions', () => {
    expect(tidyUpOffered({ ...base, actions: undefined })).toBe(false);
  });

  it('is not in an embed', () => {
    expect(tidyUpOffered({ ...base, chromeAway: true })).toBe(false);
  });
});
