// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { forgetLanding, landingNow } from './explorer-landing';

// A revoked pass sends its sessions here with `?ended=revoked` (each product's share-roles.md "Losing access is
// explained"): the Explorer reads it once, as a warning toast, and asks for it to be dropped from the address, so a
// reload or a later visit never says it again.
afterEach(() => {
  forgetLanding();
  window.history.replaceState(null, '', '/');
});

describe('the Explorer landing', () => {
  it('takes the revoked note from the address, in the app’s word, and asks to drop it', () => {
    window.history.replaceState(null, '', '/explorer?from=livediagram&ended=revoked');
    const landed = landingNow();
    expect(landed.leave).toBeNull();
    if (landed.leave !== null) return;
    expect(landed.notice).toBe(
      'The link you opened that canvas with was revoked, so it is no longer open to you.',
    );
    expect(landed.strip).toBe(true);
  });

  it('says nothing, and drops nothing, without the note', () => {
    window.history.replaceState(null, '', '/explorer?from=livediagram');
    const landed = landingNow();
    if (landed.leave !== null) throw new Error('expected to stay');
    expect(landed.notice).toBeNull();
    expect(landed.strip).toBe(false);
  });

  it('reads the address afresh on the next visit', () => {
    window.history.replaceState(null, '', '/explorer?ended=revoked');
    expect(landingNow()).toMatchObject({ notice: expect.stringMatching(/revoked/) });
    forgetLanding();
    window.history.replaceState(null, '', '/explorer');
    expect(landingNow()).toMatchObject({ notice: null });
  });

  // An editor that archived its open item leaves for here (one-explorer.md "Archiving the open item").
  it('takes the item an editor archived on its way here, and asks to drop it', () => {
    window.history.replaceState(null, '', '/explorer?archived=d1&title=Roadmap');
    const landed = landingNow();
    if (landed.leave !== null) throw new Error('expected to stay');
    expect(landed.archived).toEqual({ id: 'd1', title: 'Roadmap' });
    expect(landed.trashed).toBeNull();
    expect(landed.strip).toBe(true);
    forgetLanding();
    window.history.replaceState(null, '', '/explorer');
    expect(landingNow()).toMatchObject({ archived: null });
  });
});
