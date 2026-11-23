// Every product CLI's debug log tests, run by its debug.test.ts with its own bindings (facts.ts).
import { describe, expect, it } from 'vitest';
import type { FakeIo } from '../fake-io';
import type { CliSuiteFacts } from './facts';

export function describeDebugLog<Io extends FakeIo>(
  f: Pick<CliSuiteFacts<Io>, 'product' | 'fakeIo' | 'debugLog'>,
): void {
  const ENV = f.product.envPrefix;
  const { fakeIo, debugLog } = f;

  describe('debugLog', () => {
    it(`prints under its scope only with ${ENV}_DEBUG=1`, () => {
      const io = fakeIo({ env: { [`${ENV}_DEBUG`]: '1' } });
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
}
