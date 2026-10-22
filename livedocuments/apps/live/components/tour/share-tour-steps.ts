// The steps of Show Me in the Share dialog (docs/specs/007-editor/live-app.md "Show Me"): a tour of issuing and
// managing passes, run on the dialog itself. The engine scrolls each step's control into view; the control stays
// usable, so the owner can pick a role or create a pass while the step is up.
import type { TourStepOf } from './tour-step';

export type ShareTourApi = Record<string, never>;

type ShareTourStep = TourStepOf<ShareTourApi>;

const step = (id: string, title: string, body: string, target: string): ShareTourStep => ({
  id,
  title,
  body,
  target,
});

const ROLE = step(
  'role',
  'Choose What They Can Do',
  'Editors change anything, Participants add stickies and vote, Viewers only look. Pick one now.',
  'share-role',
);

const SCOPE = step(
  'scope',
  'Choose Which Tabs It Opens',
  'Share every tab, or just one.',
  'share-scope',
);

const VALID = step(
  'valid',
  'Set How Long It Lasts',
  'The link stops working after this. You can extend it later.',
  'share-valid',
);

const CREATE = step(
  'create',
  'Create the Pass',
  'The link is copied as soon as it is made, ready to paste.',
  'share-create',
);

const PASSES = step(
  'passes',
  'Your Passes',
  'Your links. Copy, embed, change or revoke any of them.',
  'share-passes',
);

const PASSWORD = step(
  'password',
  'Add a Password',
  'Anyone opening a link must enter it first. Note it down: we cannot show it again.',
  'share-password',
);

const OUTRO: ShareTourStep = {
  id: 'outro',
  card: 'outro',
  title: 'That Is Sharing',
  body: 'Open Share any time to make, change or revoke a link.',
};

// The steps for this document: Opens only where there is more than one tab to choose from.
export function shareTourSteps(multiTab: boolean): ShareTourStep[] {
  return [ROLE, ...(multiTab ? [SCOPE] : []), VALID, CREATE, PASSES, PASSWORD, OUTRO];
}
