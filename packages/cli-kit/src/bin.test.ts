import { afterEach, describe, expect, it, vi } from 'vitest';
import { EXIT_GRACE_MS, runBin } from './bin';
import { UPDATE_CHECK_ARG, type BinUpdate } from './update-check';

afterEach(() => vi.useRealTimers());

const quiet = () => ({ log: () => {}, info: () => {}, debug: () => {} });

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
    await runBin(run, { name: 'io' }, { proc: proc as unknown as NodeJS.Process, cons: quiet() });
    expect(run).toHaveBeenCalledWith(['tab', 'ls'], { name: 'io' });
    expect(proc.exitCode).toBe(4);
    expect(flushed).toEqual(['out', 'err']);
    expect(exit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(EXIT_GRACE_MS);
    expect(exit).toHaveBeenCalledOnce();
  });

  it('sends a module’s console lines to stderr, debug lines nowhere, so stdout carries data only', async () => {
    const written: string[] = [];
    const proc = {
      argv: ['node', 'bin.ts'],
      exitCode: undefined as number | undefined,
      stdout: { write: (_: string, done: () => void) => done() },
      stderr: { write: (text: string, done?: () => void) => (written.push(text), done?.()) },
      exit: () => {},
    };
    const cons: Pick<Console, 'log' | 'info' | 'debug'> = quiet();
    await runBin(
      async () => {
        cons.log('[x]', 1);
        cons.info('info');
        cons.debug('[arrow-label] a beside');
        return 0;
      },
      {},
      { proc: proc as unknown as NodeJS.Process, cons },
    );
    expect(written.filter(Boolean)).toEqual(['[x] 1\n', 'info\n']);
  });

  describe('the update check', () => {
    const procWith = (argv: string[], written: string[]) => ({
      argv: ['node', 'bin.ts', ...argv],
      exitCode: undefined as number | undefined,
      stdout: { write: (_: string, done: () => void) => done() },
      stderr: { write: (text: string, done?: () => void) => (written.push(text), done?.()) },
      exit: () => {},
    });
    const updateWith = (notice: string | null) => {
      const calls: string[] = [];
      const update: BinUpdate = {
        finish: async (code) => (calls.push(`finish ${code}`), notice),
        refresh: async () => void calls.push('refresh'),
      };
      return { update, calls };
    };

    it('runs after the command with its exit code, and prints the notice it returns', async () => {
      const written: string[] = [];
      const order: string[] = [];
      const { update, calls } = updateWith('example 2.0.0 is out');
      const proc = procWith(['tab', 'ls'], written);
      await runBin(
        async () => (order.push('run'), 3),
        {},
        {
          proc: proc as unknown as NodeJS.Process,
          cons: quiet(),
          update,
        },
      );
      expect(order).toEqual(['run']);
      expect(calls).toEqual(['finish 3']);
      expect(proc.exitCode).toBe(3);
      expect(written.filter(Boolean)).toEqual(['example 2.0.0 is out\n']);
    });

    it('prints nothing when the check has nothing to say', async () => {
      const written: string[] = [];
      await runBin(
        async () => 0,
        {},
        {
          proc: procWith([], written) as unknown as NodeJS.Process,
          cons: quiet(),
          update: updateWith(null).update,
        },
      );
      expect(written.filter(Boolean)).toEqual([]);
    });

    it('in the background copy, refreshes and runs no command', async () => {
      const written: string[] = [];
      const run = vi.fn(async () => 1);
      const { update, calls } = updateWith('never');
      const proc = procWith([UPDATE_CHECK_ARG], written);
      await runBin(run, {}, { proc: proc as unknown as NodeJS.Process, cons: quiet(), update });
      expect(run).not.toHaveBeenCalled();
      expect(calls).toEqual(['refresh']);
      expect(proc.exitCode).toBe(0);
      expect(written.filter(Boolean)).toEqual([]);
    });

    it('treats the argument as a command when there is no update check, or more arguments', async () => {
      for (const [argv, update] of [
        [[UPDATE_CHECK_ARG], undefined],
        [[UPDATE_CHECK_ARG, 'x'], updateWith(null).update],
      ] as const) {
        const run = vi.fn(async () => 2);
        await runBin(
          run,
          {},
          {
            proc: procWith([...argv], []) as unknown as NodeJS.Process,
            cons: quiet(),
            update,
          },
        );
        expect(run).toHaveBeenCalledWith([...argv], {});
      }
    });
  });
});
