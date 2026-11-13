// The laser pen's settings (docs/specs/008-canvas/laser-panel.md), persisted per browser
// (@liveworkspace/workbench/hooks/canvas/createToolConfig) in this editor's storage. Unlike the avatar there is no
// random roll: a surprise pen mid-presentation is the opposite of what this is for.
import { createToolConfig } from '@liveworkspace/workbench/hooks/canvas/createToolConfig';
import { loadLaserConfig, saveLaserConfig, type LaserConfig } from '@/lib/laser-config';

export const useLaserConfig = createToolConfig<LaserConfig>({
  load: () => loadLaserConfig(),
  save: (config) => saveLaserConfig(config),
  telemetryType: {
    width: 'LaserWidth',
    colour: 'LaserColour',
    trail: 'LaserTrail',
    effect: 'LaserEffect',
  },
});
