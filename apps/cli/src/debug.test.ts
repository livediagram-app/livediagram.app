import { describe, expect, it } from 'vitest';
import { debugLog } from './debug';
import { fakeIo } from './testing/fake-io';

describe('debugLog', () => {
  it('prints under its scope only with LIVEDIAGRAM_DEBUG=1', () => {
    const io = fakeIo({ env: { LIVEDIAGRAM_DEBUG: '1' } });
    debugLog(io)('command sync');
    debugLog(io, 'sync')('lock taken');
    expect(io.err()).toBe('[cli] command sync\n[sync] lock taken\n');
  });

  it('stays quiet otherwise', () => {
    const io = fakeIo();
    debugLog(io, 'link')('picker shown 3');
    expect(io.err()).toBe('');
  });
});
