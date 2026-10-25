// This editor's facts for the workbench code it runs (packages/workbench/README.md "Bindings"), handed
// over once at startup: the root providers and app/global-error.tsx call bindWorkbench at module scope,
// before anything renders.
import { configureWorkbench } from '@liveworkspace/workbench/bindings';
import { DEBUG_STORAGE_KEY } from './workbench-keys';

let bound = false;

export function bindWorkbench(): void {
  if (bound) return;
  bound = true;
  configureWorkbench({
    debugKey: DEBUG_STORAGE_KEY,
  });
}
