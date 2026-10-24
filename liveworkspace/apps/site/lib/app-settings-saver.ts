// Saving one app's settings from its dialog (liveworkspace/docs/site.md "Your account"). Each change
// shows at once and is written alone, as a patch of just the keys it touches in the app's scope; a
// write that fails puts that key back, unless a newer change to it has gone since. Kept outside
// React: the dialog's rows carry `change`, and what the saves share (the scopes as last shown, each
// key's newest change, the writes on their way) is never drawn.
import {
  storedPatch,
  type CatalogueBinding,
  type StoredValue,
} from '@liveworkspace/settings/catalogue';
import { patchAppScope, rememberAppScopes, type AppId, type AppScopes } from './app-settings';
import { reportAppSetting } from './settings-telemetry';

export interface AppSettingsSaverHandlers {
  // The scopes to show now.
  show: (next: AppScopes) => void;
  // A write failed (the error), or a new change cleared the last failure (null).
  error: (error: string | null) => void;
  saved: () => void;
}

export interface AppSettingsSaver {
  // Points the saver at the dialog's current handlers.
  connect: (handlers: AppSettingsSaverHandlers) => void;
  change: (binding: CatalogueBinding, stored: StoredValue) => void;
}

export function createAppSettingsSaver(app: AppId, initial: AppScopes): AppSettingsSaver {
  let current = initial;
  const latest: Record<string, number> = {};
  let inFlight = 0;
  let handlers: AppSettingsSaverHandlers = { show: () => {}, error: () => {}, saved: () => {} };

  const show = (next: AppScopes) => {
    current = next;
    rememberAppScopes(app, next);
    handlers.show(next);
  };

  async function save(binding: CatalogueBinding, stored: StoredValue) {
    const before = current;
    const { key } = binding;
    const had = Object.hasOwn(before.app, key);
    const previous = before.app[key];
    const patch = storedPatch(before.app, binding, stored);
    // Counted as the app's own Settings counts it, before the write as there.
    reportAppSetting(app, binding, stored);
    const turn = (latest[key] ?? 0) + 1;
    latest[key] = turn;
    handlers.error(null);
    show({ ...before, app: { ...before.app, ...patch } });
    inFlight += 1;
    const result = await patchAppScope(app, patch);
    inFlight -= 1;
    if (latest[key] !== turn) return;
    if (result.ok) {
      // The server's copy, once nothing else is on its way.
      if (inFlight === 0) show({ all: result.data.all, app: result.data.app });
      handlers.saved();
      return;
    }
    const reverted = { ...current.app };
    if (had) reverted[key] = previous;
    else delete reverted[key];
    show({ ...current, app: reverted });
    handlers.error(result.error);
  }

  return {
    connect: (next) => {
      handlers = next;
    },
    change: (binding, stored) => void save(binding, stored),
  };
}
