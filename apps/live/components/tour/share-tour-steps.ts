// The steps of Show Me in the Share dialog (docs/specs/007-editor/live-app.md "Show Me"): a tour of issuing and
// managing passes, run on the dialog itself. Each step brings the Passes tab forward (the engine scrolls its control
// into view); the control stays usable, so the owner can pick a role or create a pass while the step is up.
import type { TourStepOf } from './tour-step';

export type ShareTourApi = {
  // Brings the Passes tab forward (the Community tab may be showing).
  showPasses: () => void;
};

type ShareTourStep = TourStepOf<ShareTourApi>;

const step = (id: string, title: string, body: string, target: string): ShareTourStep => ({
  id,
  title,
  body,
  target,
  prepare: (api) => api.showPasses(),
});

const ROLE = step(
  'role',
  'Choose What They Can Do',
  'An Editor draws with you, a Participant adds stickies and votes, and a Viewer only looks. Press the card to pick one now: the tour waits.',
  'share-role',
);

const SCOPE = step(
  'scope',
  'Choose Which Tabs It Opens',
  'A pass can open every tab or just one. Whoever holds it never sees the rest.',
  'share-scope',
);

const VALID = step(
  'valid',
  'Set How Long It Lasts',
  'Forever, or a week, a month or six months, after which the link stops working. You can extend it later.',
  'share-valid',
);

const CREATE = step(
  'create',
  'Create the Pass',
  'It is copied the moment it is made, ready to paste into a message. Make one now if you like.',
  'share-create',
);

const PASSES = step(
  'passes',
  'Your Passes',
  'Every pass that still works, newest first. Copy its link again, embed it, change the tabs it opens, or revoke it to shut it at once.',
  'share-passes',
);

const PASSWORD = step(
  'password',
  'Add a Password',
  'Everyone opening any pass must type it first, embeds included. Only a scrambled copy is kept, so note it down.',
  'share-password',
);

const OUTRO: ShareTourStep = {
  id: 'outro',
  card: 'outro',
  title: 'That Is Sharing',
  body: 'Open Share from the header any time to issue, change or revoke a pass.',
};

// The steps for this document: Opens only where there is more than one tab to choose from.
export function shareTourSteps(multiTab: boolean): ShareTourStep[] {
  return [ROLE, ...(multiTab ? [SCOPE] : []), VALID, CREATE, PASSES, PASSWORD, OUTRO];
}
