import { describe, expect, it } from 'vitest';
import {
  createShape,
  isValidElement,
  opensInlineLabelEditor,
  supportsBorderControls,
  nextMessageAfter,
  renderElementsToSvg,
  sequenceDiagramOf,
  sequenceDrawing,
  withSequenceAnim,
  withSequenceRows,
} from './index';

// docs/specs/009-elements/sequence-diagram.md, blueprint sequence-diagram.md.

const seq = () => ({ ...createShape('sequence', 0, 0), id: 'q' });

describe('sequence diagram element', () => {
  it('a new one is Browser, API and Database with five valid messages', () => {
    const el = seq();
    expect(el.sequenceParticipants!.map((p) => p.label)).toEqual(['Browser', 'API', 'Database']);
    expect(el.sequenceMessages).toHaveLength(5);
    expect(isValidElement(el)).toBe(true);
  });

  it('rejects fewer than two participants and an unknown message kind', () => {
    expect(isValidElement({ ...seq(), sequenceParticipants: [{ id: 'a', label: 'A' }] })).toBe(
      false,
    );
    expect(
      isValidElement({
        ...seq(),
        sequenceMessages: [{ from: 'api', to: 'db', label: 'x', kind: 'shout' as never }],
      }),
    ).toBe(false);
  });

  it('removing a participant removes its messages', () => {
    const el = withSequenceRows(seq(), {
      participants: seq().sequenceParticipants!.filter((p) => p.id !== 'db'),
    });
    expect(el.sequenceMessages!.every((m) => m.from !== 'db' && m.to !== 'db')).toBe(true);
    expect(el.sequenceMessages).toHaveLength(3);
  });

  it('keeps at least two participants and at most twelve, ids unique', () => {
    const one = withSequenceRows(seq(), { participants: [{ id: 'x', label: 'X' }] });
    expect(one.sequenceParticipants).toHaveLength(3);
    const many = withSequenceRows(seq(), {
      participants: Array.from({ length: 20 }, () => ({ id: 'same', label: 'S' })),
    });
    expect(many.sequenceParticipants).toHaveLength(12);
    expect(new Set(many.sequenceParticipants!.map((p) => p.id)).size).toBe(12);
  });

  it('bounds messages to 60 and labels to 80 characters', () => {
    const el = withSequenceRows(seq(), {
      messages: Array.from({ length: 70 }, () => ({
        from: 'api',
        to: 'db',
        label: 'x'.repeat(100),
        kind: 'call' as const,
      })),
    });
    expect(el.sequenceMessages).toHaveLength(60);
    expect(el.sequenceMessages![0]!.label).toHaveLength(80);
  });

  it('Enter adds a message from the receiver to the participant after it, wrapping', () => {
    const el = seq();
    expect(nextMessageAfter(el, 0)).toEqual({ from: 'api', to: 'db', label: '', kind: 'call' });
    expect(nextMessageAfter(el, 2)).toEqual({ from: 'db', to: 'browser', label: '', kind: 'call' });
    expect(nextMessageAfter({ ...el, sequenceMessages: [] }, -1).from).toBe('browser');
  });

  it('describes the shared layout, numbering when on', () => {
    const d = sequenceDiagramOf({ ...seq(), sequenceNumbered: true });
    expect(d.autonumber).toBe(true);
    expect(d.items.filter((i) => i.kind === 'message')).toHaveLength(5);
  });

  it('draws the same picture for the same rows, and exports it fitted', () => {
    const el = seq();
    expect(sequenceDrawing(el)).toBe(sequenceDrawing({ ...el }));
    const svg = renderElementsToSvg({ id: 't', name: 't', elements: [el] });
    expect(svg).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(svg).toContain('Place order');
    expect(svg).toContain('Database');
  });

  it("exports in the element's own colours and face, drawn in the tab's finish", () => {
    const el = {
      ...seq(),
      fillColor: '#dcfce7',
      strokeColor: '#15803d',
      textColor: '#14532d',
      strokeWidth: undefined,
    };
    const tab = (finish?: 'sketch') =>
      ({
        id: 't',
        name: 't',
        font: 'lora',
        elements: [el],
        ...(finish ? { finish } : {}),
      }) as never;
    const svg = renderElementsToSvg(tab());
    expect(svg).toContain('stroke="#15803d"');
    expect(svg).toContain('fill="#14532d"');
    expect(svg).not.toMatch(/#0ea5e9|#075985|#f0f9ff/i);
    // Every word in the tab's face, Lora.
    const faces = new Set(svg.match(/font-family="[^"]*"/g));
    expect([...faces].every((f) => f.includes('Lora'))).toBe(true);
    // Sketch redraws its boxes by hand.
    expect(renderElementsToSvg(tab('sketch'))).not.toBe(svg);
  });

  it('draws the default look when given none, and a new look as a new picture', () => {
    const el = seq();
    expect(sequenceDrawing(el)).toContain('#0ea5e9');
    const themed = sequenceDrawing(el, { stroke: '#15803d', ink: '#14532d', fontFamily: 'Lora' });
    expect(themed).not.toBe(sequenceDrawing(el));
    expect(themed).toContain('font-family="Lora"');
    expect(sequenceDrawing(el, { stroke: '#15803d', ink: '#14532d', fontFamily: 'Lora' })).toBe(
      themed,
    );
  });

  it("writes every message in the element's ink, not the colour of its line", () => {
    const svg = sequenceDrawing(seq(), { stroke: '#15803d', ink: '#14532d' });
    // Each message label is a <text> carrying its words in a <tspan>: the fill on the <text> that opens before them.
    const fillOf = (words: string) => {
      const at = svg.indexOf(`>${words}<`);
      const open = svg.lastIndexOf('<text ', at);
      return svg.slice(open, svg.indexOf('>', open)).split('fill="')[1]?.split('"')[0];
    };
    expect(fillOf('Place order')).toBe('#14532d');
    expect(fillOf('201 Created')).toBe('#14532d');
    // The lines keep the accent.
    expect(svg).toContain('stroke="#15803d"');
  });

  it('opens no label editor (its words are its rows) but keeps its border controls', () => {
    expect(opensInlineLabelEditor('sequence')).toBe(false);
    expect(supportsBorderControls(seq())).toBe(true);
  });

  it('Play is stored only when on', () => {
    const on = withSequenceAnim(seq(), { anim: 'play', repeat: true });
    expect(on.sequenceAnim).toBe('play');
    const off = withSequenceAnim(on, { anim: null, repeat: false });
    expect('sequenceAnim' in off).toBe(false);
    expect('sequenceAnimRepeat' in off).toBe(false);
  });
});
