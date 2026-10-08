import { connect } from 'node:net';
import { describe, expect, it } from 'vitest';
import { nodeIo } from './node-io';

// The real loopback server (sign-in's callback). A browser keeps a preconnected or keep-alive socket open to
// it after the callback; closing must end those too, or the command never exits until the tab is closed.
describe('the loopback server', () => {
  it('ends open connections when closed, so the process can exit', async () => {
    const loopback = await nodeIo().listenLoopback();
    const idle = connect(loopback.port, '127.0.0.1');
    await new Promise<void>((resolve) => idle.once('connect', () => resolve()));
    const ended = new Promise<void>((resolve) => idle.once('close', () => resolve()));

    loopback.close();

    await expect(ended).resolves.toBeUndefined();
  });
});

// A process manager stops a long command (`sync --watch`) with SIGTERM as often as with SIGINT; both end it cleanly.
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
