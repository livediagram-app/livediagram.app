// A tool panel's settings (the laser pen, docs/specs/008-canvas/laser-panel.md; the eraser,
// docs/specs/008-canvas/eraser-panel.md), loaded from and written back to per-browser storage so the tool you set up
// is the one waiting next time. A persisted config object, a field-level setter for the panel's rows, and telemetry
// naming WHICH setting changed (never a value beyond its preset token, per docs/specs/017-telemetry/telemetry.md).
// Each editor binds one per tool, at module scope, to its own storage (its lib/<tool>-config).

import { useState } from 'react';
import { workbench } from '../../bindings';

export function createToolConfig<Config extends object>({
  load,
  save,
  telemetryType,
}: {
  load: () => Config;
  save: (config: Config) => void;
  // The telemetry type each field's change is counted under.
  telemetryType: Record<keyof Config, string>;
}) {
  return function useToolConfig() {
    // Lazy initial read: localStorage is unavailable during the static-export render and the safe wrapper falls
    // back there, so the first client paint matches the server's.
    const [config, setConfigState] = useState<Config>(() => load());

    const setField = <K extends keyof Config>(field: K, value: Config[K]) => {
      if (config[field] === value) return;
      const next = { ...config, [field]: value };
      setConfigState(next);
      save(next);
      workbench.track('UI', 'Changed', telemetryType[field]);
    };

    return { config, setField };
  };
}
