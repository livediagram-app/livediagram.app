import { describe, expect, it } from 'vitest';
import { ROOM_FRAME_MAX_BYTES } from '@liveplanner/api-schema';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import type { LoggedOp } from '../project-room-rules';
import { appendToOpLog, OP_LOG_LIMIT, OP_LOG_MAX_BYTES, opLogEntrySize, opLogSize } from './op-log';

const entry = (seq: number): LoggedOp => ({ seq, from: 'e', op: { kind: 'el', n: seq } });

describe('the catch-up log (Work Tracker 1231)', () => {
  it('caps at four frames and 256 ops', () => {
    expect(OP_LOG_MAX_BYTES).toBe(4 * ROOM_FRAME_MAX_BYTES);
    expect(OP_LOG_LIMIT).toBe(256);
  });

  it('drops the oldest op past the count cap', () => {
    const log: LoggedOp[] = [];
    for (let seq = 1; seq <= 5; seq++) appendToOpLog(log, entry(seq), 10, { ops: 3, bytes: 1000 });
    expect(log.map((e) => e.seq)).toEqual([3, 4, 5]);
    expect(opLogSize(log)).toBe(30);
  });

  it('drops the oldest ops past the size cap, keeping the total within it', () => {
    const log: LoggedOp[] = [];
    appendToOpLog(log, entry(1), 40, { ops: 99, bytes: 100 });
    appendToOpLog(log, entry(2), 40, { ops: 99, bytes: 100 });
    appendToOpLog(log, entry(3), 40, { ops: 99, bytes: 100 });
    expect(log.map((e) => e.seq)).toEqual([2, 3]);
    expect(opLogSize(log)).toBe(80);
    appendToOpLog(log, entry(4), 90, { ops: 99, bytes: 100 });
    expect(log.map((e) => e.seq)).toEqual([4]);
    expect(opLogSize(log)).toBe(90);
  });

  it('keeps no op larger than the whole cap', () => {
    const log: LoggedOp[] = [];
    appendToOpLog(log, entry(1), 10, { ops: 99, bytes: 100 });
    appendToOpLog(log, entry(2), 101, { ops: 99, bytes: 100 });
    expect(log).toEqual([]);
    expect(opLogSize(log)).toBe(0);
  });

  it('sizes a log put together some other way by its ops', () => {
    const seeded = [entry(1), entry(2)];
    const one = JSON.stringify(entry(1).op).length;
    expect(opLogEntrySize(seeded[0]!)).toBe(one);
    expect(opLogSize(seeded)).toBe(one * 2);
    expect(opLogEntrySize({ seq: 3, from: 'e', op: undefined })).toBe(0);
    appendToOpLog(seeded, entry(3), 5);
    expect(opLogSize(seeded)).toBe(one * 2 + 5);
  });

  it('stays linear across a long burst', () => {
    const log: LoggedOp[] = [];
    const ms = cpuMsOf(() => {
      for (let seq = 1; seq <= 50_000; seq++) appendToOpLog(log, entry(seq), 64 * 1024);
    });
    expect(log.length).toBe(OP_LOG_MAX_BYTES / (64 * 1024));
    expect(opLogSize(log)).toBeLessThanOrEqual(OP_LOG_MAX_BYTES);
    expect(ms).toBeLessThan(cpuBudgetMs(200));
  });
});
