// A refused write puts its key back to what the server last took, not to what was shown before the change:
// with an earlier change still on its way, that was the earlier change's value, which the server may never store.
import { describe, expect, it } from 'vitest';
import { createScopesSaver, type PanelScopes } from './saver';
import type { SettingsStore } from './store';

type Answer = (ok: boolean) => void;

function fakeStore() {
  const answers: Answer[] = [];
  const store = {
    remember: () => {},
    rememberShared: () => {},
    patchShared: (patch: Record<string, unknown>) =>
      new Promise((resolve) => {
        answers.push((ok) =>
          resolve(ok ? { ok: true, data: { all: patch } } : { ok: false, error: 'offline' }),
        );
      }),
  } as unknown as SettingsStore;
  return { store, answers };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

function setup() {
  const { store, answers } = fakeStore();
  let shown: PanelScopes = { all: { telemetry: false }, apps: {} };
  const errors: (string | null)[] = [];
  const saver = createScopesSaver({ store, initial: shown });
  saver.connect({
    show: (next) => (shown = next),
    error: (e) => errors.push(e),
    saved: () => {},
  });
  return { saver, answers, errors, shown: () => shown.all.telemetry };
}

describe('createScopesSaver', () => {
  it('puts back the stored value when two changes to one key are both refused', async () => {
    const { saver, answers, errors, shown } = setup();
    saver.changeShared('telemetry', true);
    saver.changeShared('telemetry', false);
    answers[0]!(false);
    await tick();
    answers[1]!(false);
    await tick();
    expect(shown()).toBe(false);
    expect(errors.at(-1)).toBe('offline');
  });

  it('puts back the earlier change once the server took it', async () => {
    const { saver, answers, shown } = setup();
    saver.changeShared('telemetry', true);
    saver.changeShared('telemetry', false);
    answers[0]!(true);
    await tick();
    answers[1]!(false);
    await tick();
    expect(shown()).toBe(true);
  });

  it('puts back the stored value when the later change is refused first', async () => {
    const { saver, answers, shown } = setup();
    saver.changeShared('telemetry', true);
    saver.changeShared('telemetry', false);
    answers[1]!(false);
    await tick();
    expect(shown()).toBe(false);
    answers[0]!(false);
    await tick();
    expect(shown()).toBe(false);
  });
});
