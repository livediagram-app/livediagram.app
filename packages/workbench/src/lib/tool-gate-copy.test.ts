// The words a tool's gate says (tool-gate-copy.ts).
import { describe, expect, it } from 'vitest';
import { toolGateCopy } from './tool-gate-copy';

describe('toolGateCopy', () => {
  it('asks a guest to sign in, and an item kept Offline to sync in its own word', () => {
    expect(toolGateCopy('sign_in', 'Automations', 'Plan').title).toBe('Sign In Needed');
    expect(toolGateCopy('sync', 'Automations', 'Design')).toEqual({
      title: 'Sync Design',
      body: 'You need to sync this design to our servers to use Automations, as it runs on our servers.',
    });
  });

  it('keeps Space capitalised inside the sentence', () => {
    expect(toolGateCopy('sync', 'Automations', 'Space').body).toBe(
      'You need to sync this Space to our servers to use Automations, as it runs on our servers.',
    );
  });
});
