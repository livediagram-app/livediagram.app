import { describe, expect, it } from 'vitest';
import type { CliIo } from './io';
import { saveToken } from './keychain';
import { svgSize } from './png';

// A macOS io whose `security` records what it was sent on stdin.
function macIo() {
  const sent: string[] = [];
  const io = {
    platform: 'darwin',
    runTool: async (_command: string, _args: readonly string[], input: string) => {
      sent.push(input);
      return { code: 0, stdout: '' };
    },
    stderr: () => {},
  } as unknown as CliIo;
  return { io, sent };
}

describe('saveToken on macOS', () => {
  it('sends one quoted add-generic-password line', async () => {
    const { io, sent } = macIo();
    const saved = await saveToken(io, 'livediagram', 'work "a"', 'lwt_x', '/c', () => {});
    expect(saved).toEqual({ keychain: true });
    expect(sent).toEqual(['add-generic-password -U -s livediagram -a "work \\"a\\"" -w "lwt_x"\n']);
  });

  it('never sends a line break to security, which would run the rest as a second command', async () => {
    for (const [profile, token] of [
      ['default', 'lwt_x"\ndelete-keychain login.keychain\n'],
      ['work\rdelete-keychain', 'lwt_x'],
      ['default', 'lwt\0x'],
    ] as const) {
      const { io, sent } = macIo();
      const saved = await saveToken(io, 'livediagram', profile, token, '/c', () => {});
      expect(sent).toEqual([]);
      // The credentials file keeps it instead.
      expect(saved).toEqual({ token });
    }
  });
});

describe('svgSize', () => {
  it('reads width and height, not the end of stroke-width', () => {
    expect(svgSize('<svg stroke-width="2" width="800" height="600">')).toEqual({
      width: 800,
      height: 600,
    });
    expect(svgSize('<svg\nwidth="10.4"\theight="20">')).toEqual({ width: 10, height: 20 });
    expect(svgSize('<p>')).toEqual({ width: 0, height: 0 });
  });
});
