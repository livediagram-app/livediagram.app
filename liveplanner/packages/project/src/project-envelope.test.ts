import { describe, expect, it } from 'vitest';
import {
  PROJECT_ENVELOPE_KIND,
  projectToEnvelopeText,
  parseProjectEnvelope,
  type EnvelopeTab,
} from './project-envelope';

// The `.liveplanner` file's contents.

const tab: EnvelopeTab = { id: 't1', name: 'Tab 1', elements: [], folder: 'Ideas' };

describe('projectToEnvelopeText', () => {
  it('wraps the project, and its tabs with folders in a liveplanner.project envelope', () => {
    const text = projectToEnvelopeText({ id: 'd1', name: 'Plan' }, [tab], 42);
    expect(JSON.parse(text)).toEqual({
      kind: PROJECT_ENVELOPE_KIND,
      schemaVersion: 1,
      exportedAt: 42,
      project: { id: 'd1', name: 'Plan', tabs: [tab] },
    });
  });

  it('is byte-identical for identical input, so md5 only moves when content does', () => {
    const a = projectToEnvelopeText({ id: 'd', name: 'n' }, [tab], 1);
    const b = projectToEnvelopeText({ id: 'd', name: 'n' }, [tab], 1);
    expect(a).toBe(b);
  });
});

describe('parseProjectEnvelope', () => {
  it('round-trips', () => {
    const text = projectToEnvelopeText({ id: 'd1', name: 'Plan' }, [tab], 7);
    const parsed = parseProjectEnvelope(text);
    expect(parsed).toEqual({ ok: true, envelope: JSON.parse(text) as unknown });
  });

  it('names each failure', () => {
    expect(parseProjectEnvelope('nope')).toEqual({ ok: false, failure: 'not_json' });
    expect(parseProjectEnvelope('{"kind":"liveplanner.tab","schemaVersion":1}')).toEqual({
      ok: false,
      failure: 'wrong_kind',
    });
    expect(parseProjectEnvelope('{"kind":"liveplanner.project","schemaVersion":2}')).toEqual({
      ok: false,
      failure: 'unsupported_version',
    });
    expect(
      parseProjectEnvelope(
        '{"kind":"liveplanner.project","schemaVersion":1,"project":{"id":"d","name":"n","tabs":[{"id":1}]}}',
      ),
    ).toEqual({ ok: false, failure: 'malformed' });
    expect(parseProjectEnvelope('null')).toEqual({ ok: false, failure: 'malformed' });
  });

  it('leaves behind a slide deck an older file carries', () => {
    const parsed = parseProjectEnvelope(
      '{"kind":"liveplanner.project","schemaVersion":1,"exportedAt":1,"project":{"id":"d","name":"n","presentation":"{}","tabs":[]}}',
    );
    expect(parsed.ok && parsed.envelope.project).toEqual({ id: 'd', name: 'n', tabs: [] });
  });
});
