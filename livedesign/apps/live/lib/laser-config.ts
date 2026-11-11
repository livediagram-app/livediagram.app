// The laser pen's settings (docs/specs/008-canvas/laser-panel.md): one copy for every editor,
// @liveworkspace/workbench, kept under this product's own key so nobody's saved pen resets.
import { laserConfigStorage } from '@liveworkspace/workbench/lib/laser-config';

export * from '@liveworkspace/workbench/lib/laser-config';

export const { loadLaserConfig, saveLaserConfig } = laserConfigStorage(
  'livedesign:v2:laser-config',
);
