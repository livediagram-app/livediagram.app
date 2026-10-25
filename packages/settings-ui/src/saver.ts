// Saving what the Settings panel changes over the accounts API (liveworkspace/docs/site.md "Settings"). Each change
// shows at once and is written alone, as a patch of just the key it touches in its scope (an app's own, or `all`);
// a write that fails puts that key back, unless a newer change to it has gone since. Kept outside React: the rows
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

  // One write: shown at once, sent, and put back if refused. `turnKey` names the stored key in its scope.
  async function write(
    turnKey: string,
    apply: (scopes: PanelScopes) => PanelScopes,
    revert: (scopes: PanelScopes) => PanelScopes,
    send: () => Promise<
      { ok: true; settle: (scopes: PanelScopes) => PanelScopes } | { ok: false; error: string }
    >,
  ) {
    const turn = (latest[turnKey] ?? 0) + 1;
    latest[turnKey] = turn;
    handlers.error(null);
    show(apply(current));
    inFlight += 1;
    const result = await send();
    inFlight -= 1;
    if (latest[turnKey] !== turn) return;
    if (result.ok) {
      // The server's copy, once nothing else is on its way.
      if (inFlight === 0) show(result.settle(current));
      handlers.saved();
      return;
    }
    show(revert(current));
    handlers.error(result.error);
  }

  // One key of `all`, written whole.
  function writeShared(key: string, value: unknown) {
    const had = Object.hasOwn(current.all, key);
    const previous = current.all[key];
    void write(
      `all:${key}`,
      (scopes) => withShared(scopes, { ...scopes.all, [key]: value }),
      (scopes) => {
        const reverted = { ...scopes.all };
        if (had) reverted[key] = previous;
        else delete reverted[key];
        return withShared(scopes, reverted);
      },
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
      const had = Object.hasOwn(before, key);
      const previous = before[key];
      const patch = storedPatch(before, binding, stored);
      reportApp?.(app, binding, stored);
      void write(
        `${app}:${key}`,
        (scopes) => withApp(scopes, app, { ...scopes.apps[app], ...patch }),
        (scopes) => {
          const reverted = { ...scopes.apps[app] };
          if (had) reverted[key] = previous;
          else delete reverted[key];
          return withApp(scopes, app, reverted);
        },
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
