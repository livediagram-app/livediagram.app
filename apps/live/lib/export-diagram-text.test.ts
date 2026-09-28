import { describe, expect, it } from 'vitest';
import {
  DIAGRAM_ENVELOPE_KIND,
  diagramToEnvelopeText,
  parseDiagramEnvelope,
  type EnvelopeTab,
} from './export-diagram-text';

// The `.livediagram` file's contents (docs/specs/022-drive-mirror/drive-mirror.md, "The file").

const tab: EnvelopeTab = { id: 't1', name: 'Tab 1', elements: [], folder: 'Ideas' };

describe('diagramToEnvelopeText', () => {
  it('wraps the diagram, its tabs with folders, and the deck in a livediagram.diagram envelope', () => {
    const text = diagramToEnvelopeText(
      { id: 'd1', name: 'Plan', presentation: '{"slides":[]}' },
      [tab],
      42,
    );
    expect(JSON.parse(text)).toEqual({
      kind: DIAGRAM_ENVELOPE_KIND,
      schemaVersion: 1,
      exportedAt: 42,
      diagram: { id: 'd1', name: 'Plan', presentation: '{"slides":[]}', tabs: [tab] },
    });
  });

  it('is byte-identical for identical input, so md5 only moves when content does', () => {
    const a = diagramToEnvelopeText({ id: 'd', name: 'n', presentation: null }, [tab], 1);
    const b = diagramToEnvelopeText({ id: 'd', name: 'n', presentation: null }, [tab], 1);
    expect(a).toBe(b);
  });
});

describe('parseDiagramEnvelope', () => {
  it('round-trips', () => {
    const text = diagramToEnvelopeText({ id: 'd1', name: 'Plan', presentation: null }, [tab], 7);
    const parsed = parseDiagramEnvelope(text);
    expect(parsed).toEqual({ ok: true, envelope: JSON.parse(text) });
  });

  it('names each failure', () => {
    expect(parseDiagramEnvelope('nope')).toEqual({ ok: false, failure: 'not_json' });
    expect(parseDiagramEnvelope('{"kind":"livediagram.tab","schemaVersion":1}')).toEqual({
      ok: false,
      failure: 'wrong_kind',
    });
    expect(parseDiagramEnvelope('{"kind":"livediagram.diagram","schemaVersion":2}')).toEqual({
      ok: false,
      failure: 'unsupported_version',
    });
    expect(
      parseDiagramEnvelope(
        '{"kind":"livediagram.diagram","schemaVersion":1,"diagram":{"id":"d","name":"n","tabs":[{"id":1}]}}',
      ),
    ).toEqual({ ok: false, failure: 'malformed' });
    expect(parseDiagramEnvelope('null')).toEqual({ ok: false, failure: 'malformed' });
  });

  it('reads a missing deck as none', () => {
    const parsed = parseDiagramEnvelope(
      '{"kind":"livediagram.diagram","schemaVersion":1,"exportedAt":1,"diagram":{"id":"d","name":"n","tabs":[]}}',
    );
    expect(parsed.ok && parsed.envelope.diagram.presentation).toBeNull();
  });
});
