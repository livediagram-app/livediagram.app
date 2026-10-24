import { describe, expect, it } from 'vitest';
import { inputReader } from './input';
import { CliError } from './output/cli-error';
import { fakeIo } from './testing/fake-io';

describe('inputReader', () => {
  it('reads a file relative to the working directory or absolute, and stdin for -', async () => {
    const io = fakeIo({
      stdin: 'from stdin',
      files: { '/work/ops.txt': 'rel', '/tmp/x.txt': 'abs' },
    });
    const read = inputReader(io);
    expect(await read('ops.txt')).toBe('rel');
    expect(await read('/tmp/x.txt')).toBe('abs');
    expect(await read('-')).toBe('from stdin');
  });

  it('takes a Windows drive or UNC path as absolute', async () => {
    const io = fakeIo({
      files: { 'C:\\x\\ops.txt': 'drive', 'D:/y.txt': 'slash', '\\\\host\\share\\z.txt': 'unc' },
    });
    const read = inputReader(io);
    expect(await read('C:\\x\\ops.txt')).toBe('drive');
    expect(await read('D:/y.txt')).toBe('slash');
    expect(await read('\\\\host\\share\\z.txt')).toBe('unc');
  });

  it('refuses a missing file, and stdin when it is a terminal', async () => {
    await expect(inputReader(fakeIo())('nope.txt')).rejects.toThrow('no file nope.txt');
    const tty = inputReader(fakeIo({ stdinIsTTY: true }));
    await expect(tty('-')).rejects.toBeInstanceOf(CliError);
    await expect(tty('-')).rejects.toThrow('- reads stdin, which is a terminal here');
  });
});
