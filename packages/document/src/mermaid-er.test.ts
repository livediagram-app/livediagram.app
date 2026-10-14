import { describe, it, expect } from 'vitest';
import { parseMermaid } from './mermaid';
import { layoutClusteredGraph } from './auto-layout-clusters';
import { isValidTab } from './validate';
import { edgeToArrow, graphToElements } from './graph-authoring';
import { entityHeight } from './entity-geometry';

// Tested through parseMermaid so the dispatch is covered too.
describe('parseMermaid: ER diagrams', () => {
  it('parses relationships with each cardinality as an ER end at its table, labelled by their verb', () => {
    const r = parseMermaid(`erDiagram
  CUSTOMER ||--o{ ORDER : places
  ORDER ||--|| INVOICE : "billed as"
  CUSTOMER }o--o{ PRODUCT : browses
  PERSON |o--|{ ADDRESS : has`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.graph.nodes.map((n) => n.id)).toEqual([
      'CUSTOMER',
      'ORDER',
      'INVOICE',
      'PRODUCT',
      'PERSON',
      'ADDRESS',
    ]);
    expect(r.graph.edges).toEqual([
      {
        from: 'CUSTOMER',
        to: 'ORDER',
        label: 'places',
        ends: 'both',
        er: { from: 'one', to: 'zero-or-many' },
      },
      {
        from: 'ORDER',
        to: 'INVOICE',
        label: 'billed as',
        ends: 'both',
        er: { from: 'one', to: 'one' },
      },
      {
        from: 'CUSTOMER',
        to: 'PRODUCT',
        label: 'browses',
        ends: 'both',
        er: { from: 'zero-or-many', to: 'zero-or-many' },
      },
      {
        from: 'PERSON',
        to: 'ADDRESS',
        label: 'has',
        ends: 'both',
        er: { from: 'zero-or-one', to: 'one-or-many' },
      },
    ]);
  });

  it('puts the many side at the start when it is on the left, and the arrow carries both ends', () => {
    const r = parseMermaid('erDiagram\n  ORDER }|--|| CUSTOMER : belongs_to');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const edge = r.graph.edges[0]!;
    expect(edge).toMatchObject({ er: { from: 'one-or-many', to: 'one' } });
    expect(edgeToArrow(edge, 'a')).toMatchObject({
      arrowEnds: 'both',
      arrowheadStartShape: 'one-or-many',
      arrowheadShape: 'one',
    });
  });

  it('leaves a relationship with no verb unlabelled: its ends say the multiplicity', () => {
    const r = parseMermaid('erDiagram\n  PERSON |o--o| PASSPORT : ""');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.graph.edges[0]!.label).toBeUndefined();
    expect(r.graph.edges[0]!.er).toEqual({ from: 'zero-or-one', to: 'zero-or-one' });
  });

  it('renders non-identifying (dotted) relationships dashed', () => {
    const r = parseMermaid('erDiagram\n  A ||..o{ B : maybe');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.graph.edges[0]).toMatchObject({ line: 'dashed' });
  });

  it('turns attribute blocks into entity field rows, keeping keys, dropping comments', () => {
    const r = parseMermaid(`erDiagram
  CUSTOMER {
    string name PK "the customer name"
    int age
    string org_id FK, UK
  }
  CUSTOMER ||--o{ ORDER : places`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const customer = r.graph.nodes.find((n) => n.id === 'CUSTOMER')!;
    expect(customer.label).toBe('CUSTOMER');
    expect(customer.fields).toEqual([
      { name: 'name', type: 'string PK' },
      { name: 'age', type: 'int' },
      { name: 'org_id', type: 'string FK,UK' },
    ]);
  });

  it('draws each entity as an entity element sized to its rows', () => {
    const r = parseMermaid('erDiagram\n  A {\n    int id PK\n    text name\n  }');
    if (!r.ok) throw new Error(r.error);
    const [a] = graphToElements(r.graph);
    expect(a).toMatchObject({
      shape: 'entity',
      label: 'A',
      textAlignX: 'left',
      textAlignY: 'top',
      height: entityHeight(2, 'sm'),
      entityFields: [
        { name: 'id', type: 'int PK' },
        { name: 'name', type: 'text' },
      ],
    });
  });

  it('accepts bare entity declarations', () => {
    const r = parseMermaid('erDiagram\n  LONELY');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.graph.nodes).toEqual([{ id: 'LONELY', label: 'LONELY', fields: [] }]);
  });

  it('errors on an empty ER diagram', () => {
    const r = parseMermaid('erDiagram');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/entities/i);
  });

  it('lays out into a valid tab', () => {
    const r = parseMermaid(`erDiagram
  CUSTOMER ||--o{ ORDER : places
  ORDER ||--|{ LINE_ITEM : contains`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const els = layoutClusteredGraph(r.graph, { direction: r.direction });
    expect(isValidTab({ id: 't', name: 'T', elements: els })).toBe(true);
    expect(els.filter((e) => e.type === 'arrow')).toHaveLength(2);
  });

  it('reads a direction line, top to bottom by default', () => {
    const text = (dir: string) =>
      ['erDiagram', ...(dir ? [dir] : []), 'A ||--o{ B : has'].join('\n');
    expect(parseMermaid(text('direction LR'))).toMatchObject({ ok: true, direction: 'LR' });
    expect(parseMermaid(text(''))).toMatchObject({ ok: true, direction: 'TB' });
  });
});
