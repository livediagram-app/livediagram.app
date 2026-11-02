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
      { name: 'name', type: 'string', key: 'pk' },
      { name: 'age', type: 'int' },
      { name: 'org_id', type: 'string', key: 'fk' },
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
        { name: 'id', type: 'int', key: 'pk' },
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

describe('ER entity aliases', () => {
  it('titles an entity with its alias, quoted or not, wherever it is named, its id kept', () => {
    const result = parseMermaid(
      [
        'erDiagram',
        '  BOOK_AUTHOR[Book author] {',
        '    uuid book_id PK',
        '  }',
        '  a["Customer account"] ||--o{ ORDER_LINE[Order line] : places',
        '  BOOK_AUTHOR }|--|| BOOK : credits',
        '  BOOK',
        '  REVIEW[Review]',
      ].join('\n'),
    );
    if (!result.ok) throw new Error(result.error);
    const label = (id: string) => result.graph.nodes.find((n) => n.id === id)?.label;
    expect(label('BOOK_AUTHOR')).toBe('Book author');
    expect(label('a')).toBe('Customer account');
    expect(label('ORDER_LINE')).toBe('Order line');
    expect(label('BOOK')).toBe('BOOK');
    expect(label('REVIEW')).toBe('Review');
    expect(result.graph.edges.map((e) => [e.from, e.to, e.label])).toEqual([
      ['a', 'ORDER_LINE', 'places'],
      ['BOOK_AUTHOR', 'BOOK', 'credits'],
    ]);
    expect(result.graph.nodes.find((n) => n.id === 'BOOK_AUTHOR')?.fields).toHaveLength(1);
  });
});

describe('ER hub first', () => {
  it('turns each relationship away from the best-connected entity, its ends swapped with it', () => {
    const result = parseMermaid(
      [
        'erDiagram',
        '  AUTHOR ||--o{ BOOK_AUTHOR : writes',
        '  BOOK_AUTHOR }|--|| BOOK : credits',
        '  PUBLISHER ||--o{ BOOK : publishes',
        '  ORDER_LINE }o--|| BOOK : "is for"',
        '  BOOK ||--o{ REVIEW : receives',
      ].join('\n'),
    );
    if (!result.ok) throw new Error(result.error);
    const edge = (label: string) => result.graph.edges.find((e) => e.label === label)!;
    for (const label of ['credits', 'publishes', 'is for', 'receives'])
      expect(edge(label).from).toBe('BOOK');
    expect(edge('credits')).toMatchObject({
      from: 'BOOK',
      to: 'BOOK_AUTHOR',
      er: { from: 'one', to: 'one-or-many' },
    });
    // One step further out: from the hub's neighbour on.
    expect(edge('writes')).toMatchObject({
      from: 'BOOK_AUTHOR',
      to: 'AUTHOR',
      er: { from: 'zero-or-many', to: 'one' },
    });
  });
});

// docs/specs/020-import-export/mermaid.md "Every way Mermaid's own docs write them".
describe('parseMermaid: ER syntax from Mermaid’s own examples', () => {
  const read = (text: string) => {
    const r = parseMermaid(text);
    if (!r.ok) throw new Error(r.error);
    return r.graph;
  };

  it('reads an operator against its names', () => {
    const g = read('erDiagram\n  id1||--||id2 : label');
    expect(g.nodes.map((n) => n.id)).toEqual(['id1', 'id2']);
    expect(g.edges[0]).toMatchObject({ label: 'label', er: { from: 'one', to: 'one' } });
  });

  it('reads cardinalities in words, to as solid and optionally to as dashed', () => {
    const g = read(`erDiagram
  CAR 1 to zero or more NAMED-DRIVER : allows
  PERSON many(0) optionally to 0+ NAMED-DRIVER : is
  TEAM only one to one or many MEMBER : has
  BADGE zero or one optionally to 1+ PERSON : names`);
    // The ends at each named table: the layout may turn a relationship round (hub first), never its ends.
    const ends = Object.fromEntries(
      g.edges.map((e) => [
        e.label,
        { [e.from]: e.er?.from, [e.to]: e.er?.to, line: e.line ?? 'solid' },
      ]),
    );
    expect(ends).toEqual({
      allows: { CAR: 'one', 'NAMED-DRIVER': 'zero-or-many', line: 'solid' },
      is: { PERSON: 'zero-or-many', 'NAMED-DRIVER': 'zero-or-many', line: 'dashed' },
      has: { TEAM: 'one', MEMBER: 'one-or-many', line: 'solid' },
      names: { BADGE: 'zero-or-one', PERSON: 'one-or-many', line: 'dashed' },
    });
  });

  it('names an entity by its quoted words, alone or in a relationship', () => {
    const g = read('erDiagram\n  "This ❤ Unicode"\n  "Order line" }o--|| PRODUCT : lists');
    expect(g.nodes.map((n) => [n.id, n.label])).toEqual([
      ['This ❤ Unicode', 'This ❤ Unicode'],
      ['Order line', 'Order line'],
      ['PRODUCT', 'PRODUCT'],
    ]);
  });

  it('skips a :::class, keeping the entity and its attributes', () => {
    const g = read(`erDiagram
  direction TB
  CAR:::someclass {
    string registrationNumber
  }
  PERSON[Driver]:::other`);
    expect(g.nodes.map((n) => [n.id, n.label, n.fields?.length ?? 0])).toEqual([
      ['CAR', 'CAR', 1],
      ['PERSON', 'Driver', 0],
    ]);
  });

  it('fails a long line that is no relationship quickly', () => {
    const hostile = 'erDiagram\n  A' + ' to'.repeat(4000) + ' x';
    const t0 = performance.now();
    parseMermaid(hostile);
    expect(performance.now() - t0).toBeLessThan(1000);
  });
});
