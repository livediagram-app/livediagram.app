// Saving what the Settings panel changes over the accounts API (liveworkspace/docs/specs/010-site/site.md "Settings"). Each change
// shows at once and is written alone, as a patch of just the key it touches in its scope (an app's own, or `all`);
// a write that fails puts that key back to what the server last took, unless a newer change to it has gone since. Kept outside React: the rows
// carry `change`, and what the saves share (the scopes as last shown, each key's newest change, the writes on their
// way) is never drawn.
import { isAllSetting, joinSettings, type SettingsBlob } from '@liveworkspace/settings';
import {
  storedPatch,
  type CatalogueBinding,
  type StoredValue,
} from '@liveworkspace/settings/catalogue';
import type { SettingsAppId, SettingsStore } from './store';

// Everything the panel has read: the `all` scope, and each shown app's own.
export interface PanelScopes {
  all: SettingsBlob;
  apps: Partial<Record<SettingsAppId, SettingsBlob>>;
}

export interface ScopesSaverHandlers {
  // The scopes to show now.
  show: (next: PanelScopes) => void;
  // A write failed (the error), or a new change cleared the last failure (null).
  error: (error: string | null) => void;
  saved: () => void;
}

export interface ScopesSaver {
  // Points the saver at the panel's current handlers.
  connect: (handlers: ScopesSaverHandlers) => void;
  // A row of an app's catalogue changed. A row over a shared key (a common setting) is written to `all`, counted as
  // the app's row.
  changeApp: (app: SettingsAppId, binding: CatalogueBinding, stored: StoredValue) => void;
  // A switch of the Account section changed (the `all` scope).
  changeShared: (key: string, value: StoredValue) => void;
}

export interface ScopesSaverOptions {
  store: SettingsStore;
  initial: PanelScopes;
  // Counts an app's row as that app's own Settings counts it, before the write as there.
  reportApp?: (app: SettingsAppId, binding: CatalogueBinding, stored: StoredValue) => void;
  // Counts an Account switch, as the apps count it.
  reportShared?: (key: string, value: StoredValue) => Promise<void> | void;
}

export function createScopesSaver({
  store,
  initial,
  reportApp,
  reportShared,
}: ScopesSaverOptions): ScopesSaver {
  let current = initial;
  const latest: Record<string, number> = {};
  // Per key: the writes on their way, and the value the server last took (from the newest write it answered OK),
  // which is what a refused write puts back. The value shown before a change is not that once an earlier change
  // to the key is still on its way: two refused writes put back the first one's value, never stored.
  const pending: Record<string, number> = {};
  const confirmed: Record<string, { turn: number; back: Back }> = {};
  let inFlight = 0;
  let handlers: ScopesSaverHandlers = { show: () => {}, error: () => {}, saved: () => {} };

  const show = (next: PanelScopes) => {
    current = next;
    handlers.show(next);
  };
  const withApp = (scopes: PanelScopes, app: SettingsAppId, blob: SettingsBlob): PanelScopes => {
    store.remember(app, { all: scopes.all, app: blob });
    return { ...scopes, apps: { ...scopes.apps, [app]: blob } };
  };
  const withShared = (scopes: PanelScopes, all: SettingsBlob): PanelScopes => {
    store.rememberShared(all);
    return { ...scopes, all };
  };

  // One write: shown at once, sent, and put back if refused. `turnKey` names the stored key in its scope; `before`
  // is the key as shown now, and `sent` the value written.
  async function write(
    turnKey: string,
    before: Back,
    sent: unknown,
    apply: (scopes: PanelScopes) => PanelScopes,
    revert: (scopes: PanelScopes, back: Back) => PanelScopes,
    send: () => Promise<
      { ok: true; settle: (scopes: PanelScopes) => PanelScopes } | { ok: false; error: string }
    >,
  ) {
    const turn = (latest[turnKey] ?? 0) + 1;
    latest[turnKey] = turn;
    // With nothing on its way for this key, what is shown is what the server holds.
    if (!pending[turnKey]) confirmed[turnKey] = { turn: turn - 1, back: before };
    pending[turnKey] = (pending[turnKey] ?? 0) + 1;
    handlers.error(null);
    show(apply(current));
    inFlight += 1;
    const result = await send();
    inFlight -= 1;
    pending[turnKey] -= 1;
    if (result.ok && turn > confirmed[turnKey]!.turn) {
      confirmed[turnKey] = { turn, back: { had: true, value: sent } };
    }
    if (latest[turnKey] !== turn) return;
    if (result.ok) {
      // The server's copy, once nothing else is on its way.
      if (inFlight === 0) show(result.settle(current));
      handlers.saved();
      return;
    }
    show(revert(current, confirmed[turnKey]!.back));
    handlers.error(result.error);
  }

  // One key of `all`, written whole.
  function writeShared(key: string, value: unknown) {
    void write(
      `all:${key}`,
      { had: Object.hasOwn(current.all, key), value: current.all[key] },
      value,
      (scopes) => withShared(scopes, { ...scopes.all, [key]: value }),
      (scopes, back) => withShared(scopes, putBack(scopes.all, key, back)),
      async () => {
        const result = await store.patchShared({ [key]: value });
        return result.ok
          ? { ok: true, settle: (scopes) => withShared(scopes, result.data.all) }
          : { ok: false, error: result.error };
      },
    );
  }

  return {
    connect: (next) => {
      handlers = next;
    },
    changeApp(app, binding, stored) {
      if (isAllSetting(binding.key)) {
        reportApp?.(app, binding, stored);
        // A field is written into the object as the app reads it: `all`'s, else the app's copy from before it was
        // shared, so the object's other fields are kept.
        const base = joinSettings(current.all, current.apps[app] ?? {});
        writeShared(binding.key, storedPatch(base, binding, stored)[binding.key]);
        return;
      }
      const before = current.apps[app] ?? {};
      const { key } = binding;
      const patch = storedPatch(before, binding, stored);
      reportApp?.(app, binding, stored);
      void write(
        `${app}:${key}`,
        { had: Object.hasOwn(before, key), value: before[key] },
        patch[key],
        (scopes) => withApp(scopes, app, { ...scopes.apps[app], ...patch }),
        (scopes, back) => withApp(scopes, app, putBack(scopes.apps[app] ?? {}, key, back)),
        async () => {
          const result = await store.patchApp(app, patch);
          return result.ok
            ? {
                ok: true,
                settle: (scopes) =>
                  withApp(withShared(scopes, result.data.all), app, result.data.app),
              }
            : { ok: false, error: result.error };
        },
      );
    },
    changeShared(key, value) {
      // The host counts it (and, turning telemetry off, waits for that event before it stops counting).
      void reportShared?.(key, value);
      writeShared(key, value);
    },
  };
}

// A key as it stood: present with a value, or absent.
type Back = { had: boolean; value: unknown };

function putBack(blob: SettingsBlob, key: string, back: Back): SettingsBlob {
  const reverted = { ...blob };
  if (back.had) reverted[key] = back.value;
  else delete reverted[key];
  return reverted;
}
