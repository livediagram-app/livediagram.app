import { describe, expect, it } from 'vitest';
import { peerModeSwitchMessage, peerModeSwitchOf } from './peer-mode-switch';

// docs/specs/007-editor/editor-modes.md "Where the mode lives": everyone follows a switch.
describe('peerModeSwitchOf', () => {
  it('reads a mode set, or cleared back to Diagram, from a tab-meta op', () => {
    expect(
      peerModeSwitchOf({ kind: 'tab-meta', tabId: 't', patch: { opensIn: 'illustrate' } }),
    ).toEqual({ tabId: 't', mode: 'illustrate' });
    expect(
      peerModeSwitchOf({ kind: 'tab-meta', tabId: 't', patch: {}, clear: ['pages', 'opensIn'] }),
    ).toEqual({ tabId: 't', mode: 'diagram' });
  });

  it('ignores ops that leave the mode alone', () => {
    expect(peerModeSwitchOf({ kind: 'tab-meta', tabId: 't', patch: { name: 'X' } })).toBeNull();
    expect(
      peerModeSwitchOf({ kind: 'tab-meta', tabId: 't', patch: {}, clear: ['timer'] }),
    ).toBeNull();
    expect(peerModeSwitchOf({ kind: 'tab-focus', tabId: 't' })).toBeNull();
  });
});

describe('peerModeSwitchMessage', () => {
  it('names who switched, or says someone', () => {
    expect(peerModeSwitchMessage('Ada', 'draw')).toBe('Ada switched this tab to Draw.');
    expect(peerModeSwitchMessage('  ', 'illustrate')).toBe(
      'Someone switched this tab to Illustrate.',
    );
    expect(peerModeSwitchMessage(null, 'plan')).toBe('Someone switched this tab to Plan.');
  });
});
