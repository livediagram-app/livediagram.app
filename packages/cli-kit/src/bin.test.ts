import { afterEach, describe, expect, it, vi } from 'vitest';
import { EXIT_GRACE_MS, runBin } from './bin';

afterEach(() => vi.useRealTimers());

describe('runBin', () => {
  it('runs the command on the arguments, then exits a grace after both streams flush', async () => {
    vi.useFakeTimers();
    const flushed: string[] = [];
    const exit = vi.fn();
    const proc = {
      argv: ['node', 'bin.ts', 'tab', 'ls'],
      exitCode: undefined as number | undefined,
      stdout: { write: (_: string, done: () => void) => (flushed.push('out'), done()) },
      stderr: { write: (_: string, done: () => void) => (flushed.push('err'), done()) },
      exit,
    };
    const run = vi.fn(async (argv: string[], io: { name: string }) => argv.length + io.name.length);
    await runBin(run, { name: 'io' }, proc as unknown as NodeJS.Process);
    expect(run).toHaveBeenCalledWith(['tab', 'ls'], { name: 'io' });
    expect(proc.exitCode).toBe(4);
    expect(flushed).toEqual(['out', 'err']);
    expect(exit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(EXIT_GRACE_MS);
    expect(exit).toHaveBeenCalledOnce();
  });
});
