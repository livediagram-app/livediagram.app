import { describe, expect, it, vi } from 'vitest';
import { automaticPresenceColour } from '@liveworkspace/settings/presence';
import { announceProfileSaved, onProfileSaved, participantWithProfile } from './profile-events';

const me = { id: 'p1', name: 'Ada Quinn', color: '#0ea5e9' };

describe('participantWithProfile', () => {
  it("takes a saved name and colour, keeping what the patch didn't name", () => {
    expect(
      participantWithProfile(me, {
        patch: { color: '#8b5cf6' },
        name: 'Ada Quinn',
        color: '#8b5cf6',
      }),
    ).toEqual({ ...me, color: '#8b5cf6' });
    expect(
      participantWithProfile(me, { patch: { name: 'Ada Q' }, name: 'Ada Q', color: '#0ea5e9' }),
    ).toEqual({ ...me, name: 'Ada Q' });
  });

  it('paints Automatic in the colour picked from the name, the one rule the avatars use', () => {
    expect(
      participantWithProfile(me, { patch: { color: null }, name: 'Ada Quinn', color: null })?.color,
    ).toBe(automaticPresenceColour('Ada Quinn').value);
    // A rename with Automatic in the same save picks from the new name.
    expect(
      participantWithProfile(me, { patch: { name: 'Bo', color: null }, name: 'Bo', color: null }),
    ).toEqual({ ...me, name: 'Bo', color: automaticPresenceColour('Bo').value });
  });

  it("keeps the participant's name when the profile answered none, and says when nothing changed", () => {
    expect(
      participantWithProfile(me, { patch: { name: null }, name: null, color: '#0ea5e9' }),
    ).toBeNull();
    expect(
      participantWithProfile(me, { patch: { showPicture: false }, name: null, color: null }),
    ).toBeNull();
  });
});

describe('onProfileSaved', () => {
  it('tells every listener until it stops, and one failing listener spares the rest', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const heard = vi.fn();
    const stopBad = onProfileSaved(() => {
      throw new Error('boom');
    });
    const stop = onProfileSaved(heard);
    const saved = { patch: { color: null }, name: 'Ada', color: null };
    announceProfileSaved(saved);
    expect(heard).toHaveBeenCalledWith(saved);
    expect(error).toHaveBeenCalled();
    stop();
    stopBad();
    announceProfileSaved(saved);
    expect(heard).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });
});
