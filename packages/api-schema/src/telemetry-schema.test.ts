// Telemetry ingest validator (spec/22). The POST /api/events endpoint
// filters every incoming batch through `isValidTelemetryEvent` from
// @livediagram/api-schema before writing to D1. Validation is the
// last line of defence against a malicious client posting events
// outside the closed vocabulary; if it ever regresses, the public
// telemetry dashboard could surface arbitrary attacker-supplied
// strings or inflate counts on enum values that don't exist. These
// tests pin the validator's behaviour so a future enum extension or
// type-pattern tweak can't accidentally loosen the gate.

import { describe, expect, it } from 'vitest';
import {
  isValidTelemetryEvent,
  TELEMETRY_ACTIONS,
  TELEMETRY_CATEGORIES,
  TELEMETRY_TYPE_PATTERN,
} from './telemetry-schema';

describe('isValidTelemetryEvent', () => {
  describe('non-object inputs', () => {
    it('rejects null', () => {
      expect(isValidTelemetryEvent(null)).toBe(false);
    });
    it('rejects undefined', () => {
      expect(isValidTelemetryEvent(undefined)).toBe(false);
    });
    it('rejects a number', () => {
      expect(isValidTelemetryEvent(42)).toBe(false);
    });
    it('rejects a string', () => {
      expect(isValidTelemetryEvent('Element')).toBe(false);
    });
    it('rejects a boolean', () => {
      expect(isValidTelemetryEvent(true)).toBe(false);
    });
    it('rejects an array (typeof [] === "object" so the missing-category check is what saves us)', () => {
      expect(isValidTelemetryEvent(['Element', 'Added', 'Square'])).toBe(false);
    });
  });

  describe('category gate', () => {
    it('rejects an unknown category', () => {
      expect(isValidTelemetryEvent({ category: 'Pwned', action: 'Added' })).toBe(false);
    });
    it('rejects a missing category', () => {
      expect(isValidTelemetryEvent({ action: 'Added' })).toBe(false);
    });
    it('rejects a category of the wrong type', () => {
      expect(isValidTelemetryEvent({ category: 42, action: 'Added' })).toBe(false);
    });
    it('accepts every category in the closed enum', () => {
      // Strong signal that the gate IS reading the same enum the api
      // schema exports; if anyone hand-edits the validator to
      // hard-code a stale list, this catches it.
      for (const category of TELEMETRY_CATEGORIES) {
        expect(isValidTelemetryEvent({ category, action: 'Added' })).toBe(true);
      }
    });
  });

  describe('action gate', () => {
    it('rejects an unknown action', () => {
      expect(isValidTelemetryEvent({ category: 'Element', action: 'Hacked' })).toBe(false);
    });
    it('rejects a missing action', () => {
      expect(isValidTelemetryEvent({ category: 'Element' })).toBe(false);
    });
    it('rejects an action of the wrong type', () => {
      expect(isValidTelemetryEvent({ category: 'Element', action: 7 })).toBe(false);
    });
    it('accepts every action in the closed enum', () => {
      for (const action of TELEMETRY_ACTIONS) {
        expect(isValidTelemetryEvent({ category: 'Element', action })).toBe(true);
      }
    });
  });

  describe('type gate', () => {
    it('accepts undefined type (optional field)', () => {
      expect(
        isValidTelemetryEvent({ category: 'Element', action: 'Deleted', type: undefined }),
      ).toBe(true);
    });
    it('accepts null type', () => {
      expect(isValidTelemetryEvent({ category: 'Element', action: 'Deleted', type: null })).toBe(
        true,
      );
    });
    it('accepts a short, safe-character type', () => {
      expect(isValidTelemetryEvent({ category: 'Element', action: 'Added', type: 'Square' })).toBe(
        true,
      );
    });
    it('accepts type with spaces, dots, dashes, underscores (preset labels)', () => {
      expect(
        isValidTelemetryEvent({ category: 'Theme', action: 'Changed', type: 'High Contrast' }),
      ).toBe(true);
      expect(isValidTelemetryEvent({ category: 'Diagram', action: 'Exported', type: 'PDF' })).toBe(
        true,
      );
      expect(
        isValidTelemetryEvent({ category: 'Element', action: 'Added', type: 'a_b-c.d 1' }),
      ).toBe(true);
    });

    it.each([
      ['html injection', '<script>'],
      ['slash', 'a/b'],
      ['double quote', '"x"'],
      ['single quote', "a'b"],
      ['colon', 'a:b'],
      ['semicolon', 'a;b'],
      ['at-sign', 'a@b'],
      ['hash', 'a#b'],
      ['newline', '\n'],
      ['backslash', 'a\\b'],
      ['tab character', '\t'],
    ])('rejects type with %s', (_label, type) => {
      expect(isValidTelemetryEvent({ category: 'Element', action: 'Added', type })).toBe(false);
    });

    it('rejects an empty-string type', () => {
      expect(isValidTelemetryEvent({ category: 'Element', action: 'Added', type: '' })).toBe(false);
    });
    it('rejects a type longer than the pattern allows (>40 chars)', () => {
      const longType = 'A'.repeat(41);
      expect(isValidTelemetryEvent({ category: 'Element', action: 'Added', type: longType })).toBe(
        false,
      );
    });
    it('accepts a type of exactly 40 chars', () => {
      const maxType = 'A'.repeat(40);
      expect(isValidTelemetryEvent({ category: 'Element', action: 'Added', type: maxType })).toBe(
        true,
      );
    });
    it('rejects a non-string non-nullable type', () => {
      expect(isValidTelemetryEvent({ category: 'Element', action: 'Added', type: 7 })).toBe(false);
      expect(isValidTelemetryEvent({ category: 'Element', action: 'Added', type: true })).toBe(
        false,
      );
      expect(isValidTelemetryEvent({ category: 'Element', action: 'Added', type: {} })).toBe(false);
    });
  });

  describe('extra fields', () => {
    it("ignores keys outside the schema (doesn't crash; the worker drops them on insert)", () => {
      // The worker only writes category / action / type / ts to D1
      // regardless of what the client sends, so extra fields in a
      // valid event are harmless. The validator should accept them.
      expect(
        isValidTelemetryEvent({
          category: 'Element',
          action: 'Added',
          type: 'Square',
          attackerOwnerId: 'pwn',
          extra: { nested: 'data' },
        }),
      ).toBe(true);
    });
  });
});

describe('TELEMETRY_TYPE_PATTERN', () => {
  // The validator delegates to this pattern, but the pattern is also
  // re-used elsewhere if it ever ships in client code that doesn't
  // call isValidTelemetryEvent. Pin its shape too.
  it('matches the documented safe-character set', () => {
    expect(TELEMETRY_TYPE_PATTERN.test('Square')).toBe(true);
    expect(TELEMETRY_TYPE_PATTERN.test('PDF')).toBe(true);
    expect(TELEMETRY_TYPE_PATTERN.test('High Contrast')).toBe(true);
    expect(TELEMETRY_TYPE_PATTERN.test('<svg>')).toBe(false);
    expect(TELEMETRY_TYPE_PATTERN.test('a\nb')).toBe(false);
    expect(TELEMETRY_TYPE_PATTERN.test('')).toBe(false);
  });
});
