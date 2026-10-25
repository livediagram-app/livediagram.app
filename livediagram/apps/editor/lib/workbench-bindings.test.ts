import { afterEach, describe, expect, it } from 'vitest';
import { resetWorkbenchForTests, workbench } from '@liveworkspace/workbench/bindings';
import { bindWorkbench } from './workbench-bindings';
import { DEBUG_STORAGE_KEY } from './workbench-keys';

afterEach(() => resetWorkbenchForTests());

describe('workbench bindings', () => {
  it("keeps this editor's keys as they are: people's saved flags live under them", () => {
    expect(DEBUG_STORAGE_KEY).toBe('livediagram:debug');
  });

  it('hands the workbench these facts', () => {
    bindWorkbench();
    expect(workbench.debugKey).toBe(DEBUG_STORAGE_KEY);
  });
});
