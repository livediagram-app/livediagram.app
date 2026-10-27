import { afterEach, describe, expect, it } from 'vitest';
import { resetWorkbenchForTests, workbench } from '@liveworkspace/workbench/bindings';
import { PANEL_LAYOUT_CHANGED_EVENT } from './panel-layout';
import { bindWorkbench } from './workbench-bindings';
import {
  APP_RECOVERY_FLAG,
  E2E_SESSION_KEY,
  DEBUG_STORAGE_KEY,
  HIDE_CURSORS_KEY,
  LOCAL_MOVE_DISMISSED_PREFIX,
  OPEN_SETTINGS_EVENT,
  PANEL_PRESENCE_EVENT,
  RELOAD_GUARD_KEY,
  START_QUERY_KEY,
} from './workbench-keys';

afterEach(() => resetWorkbenchForTests());

describe('workbench bindings', () => {
  it("keeps this editor's keys as they are: people's saved flags live under them", () => {
    expect(DEBUG_STORAGE_KEY).toBe('liveplanner:debug');
    expect(RELOAD_GUARD_KEY).toBe('liveplanner:stale-chunk-reloads');
    expect(APP_RECOVERY_FLAG).toBe('__liveplannerChunkRecovery');
    expect(OPEN_SETTINGS_EVENT).toBe('liveplanner:open-settings');
    expect(PANEL_PRESENCE_EVENT).toBe('liveplanner:panel-presence');
    expect(START_QUERY_KEY).toBe('liveplanner:v2:start-query');
    expect(HIDE_CURSORS_KEY).toBe('liveplanner:v2:hide-cursors');
    expect(LOCAL_MOVE_DISMISSED_PREFIX).toBe('liveplanner:v2:local-move-dismissed:');
    expect(E2E_SESSION_KEY).toBe('liveplanner:e2e:session');
  });

  it('hands the workbench these facts', () => {
    bindWorkbench();
    expect(workbench.debugKey).toBe(DEBUG_STORAGE_KEY);
    expect(workbench.reloadGuardKey).toBe(RELOAD_GUARD_KEY);
    expect(workbench.appRecoveryFlag).toBe(APP_RECOVERY_FLAG);
    expect(workbench.formatLogScope).toBe('project-format');
    expect(workbench.panelLayoutEvent).toBe(PANEL_LAYOUT_CHANGED_EVENT);
    expect(workbench.openSettingsEvent).toBe(OPEN_SETTINGS_EVENT);
    expect(workbench.panelPresenceEvent).toBe(PANEL_PRESENCE_EVENT);
    expect(workbench.startQueryKey).toBe(START_QUERY_KEY);
    expect(workbench.hideCursorsKey).toBe(HIDE_CURSORS_KEY);
    expect(workbench.localMoveDismissedPrefix).toBe(LOCAL_MOVE_DISMISSED_PREFIX);
  });
});
