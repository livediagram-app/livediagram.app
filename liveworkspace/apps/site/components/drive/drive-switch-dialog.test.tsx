// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DriveResult } from '@liveworkspace/drive/client';
import {
  ACCOUNT_SWITCH_BODY,
  ACCOUNT_SWITCH_EXPIRED,
  ACCOUNT_SWITCH_FAILED,
  DriveSwitchDialog,
} from './DriveSwitchDialog';

// Switch Google Account? on /drive/connected (liveworkspace/docs/drive.md "Connecting").
let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const answer = (result: DriveResult<unknown>) => vi.fn(async () => result);
const button = (name: string) =>
  [...document.querySelectorAll('button')].find((b) => b.textContent === name)!;

async function mount(confirm: ReturnType<typeof answer>, cancel: ReturnType<typeof answer>) {
  const onSwitched = vi.fn();
  const onKept = vi.fn();
  await act(async () =>
    root.render(
      <DriveSwitchDialog
        client={{ confirmSwitch: confirm, cancelSwitch: cancel }}
        onSwitched={onSwitched}
        onKept={onKept}
        cloudSyncHref="https://lw.test/explorer?settings=profile"
      />,
    ),
  );
  return { onSwitched, onKept };
}

describe('DriveSwitchDialog', () => {
  it('asks, and Switch Account confirms the pending switch', async () => {
    const confirm = answer({ ok: true, data: undefined });
    const { onSwitched, onKept } = await mount(confirm, answer({ ok: true, data: undefined }));
    expect(document.body.textContent).toContain('Switch Google Account?');
    expect(document.body.textContent).toContain(ACCOUNT_SWITCH_BODY);
    await act(async () => button('Switch Account').click());
    expect(confirm).toHaveBeenCalledOnce();
    expect(onSwitched).toHaveBeenCalledOnce();
    expect(onKept).not.toHaveBeenCalled();
  });

  it('Keep Current Account cancels it, and the connection stays as it was', async () => {
    const cancel = answer({ ok: true, data: undefined });
    const { onSwitched, onKept } = await mount(answer({ ok: true, data: undefined }), cancel);
    await act(async () => button('Keep Current Account').click());
    expect(cancel).toHaveBeenCalledOnce();
    expect(onKept).toHaveBeenCalledOnce();
    expect(onSwitched).not.toHaveBeenCalled();
  });

  it('says a switch past its 30 minutes timed out, with the way back to Cloud Sync', async () => {
    const { onSwitched } = await mount(
      answer({ ok: false, status: 409, error: 'failed' }),
      answer({ ok: true, data: undefined }),
    );
    await act(async () => button('Switch Account').click());
    expect(onSwitched).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(ACCOUNT_SWITCH_EXPIRED);
    const back = [...document.querySelectorAll('a')].find((a) => a.textContent === 'Back to Cloud Sync');
    expect(back?.getAttribute('href')).toBe('https://lw.test/explorer?settings=profile');
  });

  it('keeps the dialog open on a failure, saying nothing changed', async () => {
    await mount(answer({ ok: false, status: 0, error: 'offline' }), answer({ ok: true, data: undefined }));
    await act(async () => button('Switch Account').click());
    expect(document.body.textContent).toContain(ACCOUNT_SWITCH_FAILED);
    expect(button('Switch Account').disabled).toBe(false);
  });
});
