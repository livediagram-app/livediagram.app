import { afterEach, describe, expect, it } from 'vitest';
import { resetWorkbenchForTests, workbench } from '@liveworkspace/workbench/bindings';
import { bindWorkbench } from './workbench-bindings';
import { APP_RECOVERY_FLAG, DEBUG_STORAGE_KEY, RELOAD_GUARD_KEY } from './workbench-keys';

afterEach(() => resetWorkbenchForTests());

describe('workbench bindings', () => {
  it("keeps this editor's keys as they are: people's saved flags live under them", () => {
    expect(DEBUG_STORAGE_KEY).toBe('liveplanner:debug');
    expect(RELOAD_GUARD_KEY).toBe('liveplanner:stale-chunk-reloads');
    expect(APP_RECOVERY_FLAG).toBe('__liveplannerChunkRecovery');
  });

  it('hands the workbench these facts', () => {
    bindWorkbench();
    expect(workbench.debugKey).toBe(DEBUG_STORAGE_KEY);
    expect(workbench.reloadGuardKey).toBe(RELOAD_GUARD_KEY);
    expect(workbench.appRecoveryFlag).toBe(APP_RECOVERY_FLAG);
    expect(workbench.formatLogScope).toBe('project-format');
  });
});
