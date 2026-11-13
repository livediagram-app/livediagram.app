// The eraser's settings (docs/specs/008-canvas/eraser-panel.md), persisted per browser
// (@liveworkspace/workbench/hooks/canvas/createToolConfig) in this editor's storage.
import { createToolConfig } from '@liveworkspace/workbench/hooks/canvas/createToolConfig';
import { loadEraserConfig, saveEraserConfig, type EraserConfig } from '@/lib/eraser-config';

export const useEraserConfig = createToolConfig<EraserConfig>({
  load: () => loadEraserConfig(),
  save: (config) => saveEraserConfig(config),
  telemetryType: { mode: 'EraserMode', size: 'EraserSize', target: 'EraserTarget' },
});
