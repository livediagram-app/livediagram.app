import { connect } from 'node:net';
import { describe, expect, it } from 'vitest';
import { nodeIo, openerFor } from './node-io';

// The real loopback server (sign-in's callback). A browser keeps a preconnected or keep-alive socket open to
// it after the callback; closing must end those too, or the command never exits until the tab is closed.
describe('the loopback server', () => {
  it('ends open connections when closed, so the process can exit', async () => {
    const loopback = await nodeIo().listenLoopback();
    const idle = connect(loopback.port, '127.0.0.1');
    // The server ends it by destroying the socket, which the client may see as a reset: expected.
    idle.on('error', () => {});
    await new Promise<void>((resolve) => idle.once('connect', () => resolve()));
    const ended = new Promise<void>((resolve) => idle.once('close', () => resolve()));
    // Closing destroys the connection, which this end may see as a reset: that is the ending, not a failure.
    idle.on('error', () => {});

    loopback.close();

    await expect(ended).resolves.toBeUndefined();
  });
});

// A process manager stops a long command (`watch`) with SIGTERM as often as with SIGINT; both end it cleanly.
describe('interrupts', () => {
  it.each(['SIGINT', 'SIGTERM'] as const)('hears %s, once, until released', (signal) => {
    let heard = 0;
    const release = nodeIo().onInterrupt(() => void heard++);

    process.emit(signal);
    process.emit(signal);
    release();

    expect(heard).toBe(1);
    expect(process.listenerCount('SIGINT') + process.listenerCount('SIGTERM')).toBe(0);
  });
});

// Opening the sign-in URL (CLI34): never through a shell, so `&` in the query is a character, not a command.
describe('openerFor', () => {
  const url = 'https://example.app/oauth/authorize?a=1&b=2&calc.exe';

  it('hands Windows the URL as one rundll32 argument, never cmd', () => {
    expect(openerFor('win32', url)).toEqual(['rundll32', ['url.dll,FileProtocolHandler', url]]);
  });

  it('uses open on macOS and xdg-open elsewhere', () => {
    expect(openerFor('darwin', url)).toEqual(['open', [url]]);
    expect(openerFor('linux', url)).toEqual(['xdg-open', [url]]);
  });

  it('opens nothing that is not an http(s) URL', () => {
    expect(openerFor('win32', 'file:///C:/Windows/System32/calc.exe')).toBeNull();
    expect(openerFor('linux', '--help')).toBeNull();
  });
});

describe('runTool and a git hook environment', () => {
  const show = ['-e', 'process.stdout.write(process.env.GIT_DIR ?? "unset")'];

  it('keeps GIT_DIR for a command that is not git', async () => {
    process.env.GIT_DIR = '/hook/repo';
    try {
      const run = await nodeIo().runTool(process.execPath, show, '');
      expect(run).toEqual({ code: 0, stdout: '/hook/repo' });
    } finally {
      delete process.env.GIT_DIR;
    }
  });

  it('strips GIT_DIR for git, so it answers for the directory it is asked about', async () => {
    process.env.GIT_DIR = '/hook/repo/.git';
    try {
      const run = await nodeIo().runTool('git', ['rev-parse', '--git-dir'], '');
      expect(run?.stdout.trim()).not.toBe('/hook/repo/.git');
    } finally {
      delete process.env.GIT_DIR;
    }
  });
});
