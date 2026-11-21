import { describe, expect, it } from 'vitest';
import {
  AUTOMATIONS_SCHEMA,
  AUTOMATION_SCHEMA_STEPS,
  automationSchemaStep,
  automationsScheduleStep,
} from './automation-schema';
import { bareSql, migrate, rowsOf } from './test-sql';

describe('the Automations tables', () => {
  it('makes every table, and runs again harmlessly', () => {
    const sql = bareSql();
    migrate(sql);
    migrate(sql);
    const tables = rowsOf(
      sql,
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    ).map((r) => r['name']);
    expect(tables).toEqual([
      'automation_ai_days',
      'automation_ai_drafts',
      'automation_email_addresses',
      'automation_email_days',
      'automation_fired',
      'automation_hook_seen',
      'automation_hooks',
      'automation_queue',
      'automation_rules',
      'automation_runs',
      'automation_schedule',
      'automation_waiting',
    ]);
    const turn = rowsOf(sql, 'PRAGMA table_info(automation_rules)').filter(
      (c) => c['name'] === 'turn',
    );
    expect(turn).toHaveLength(1);
  });

  it('names its steps in the order they shipped', () => {
    expect(AUTOMATION_SCHEMA_STEPS.map((s) => s.name)).toEqual([
      'rules',
      'schedule',
      'hooks',
      'waiting',
      'ai_drafts',
      'fired',
      'addresses',
      'counts',
    ]);
    expect(automationSchemaStep('rules')).toBe(AUTOMATIONS_SCHEMA);
    expect(automationSchemaStep('schedule')).toBe(automationsScheduleStep);
  });
});
