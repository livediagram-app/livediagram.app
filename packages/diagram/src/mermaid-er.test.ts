import { describe, it, expect } from 'vitest';
import { parseMermaid } from './mermaid';
import { layoutClusteredGraph } from './auto-layout-clusters';
import { isValidTab } from './validate';

// Tested through parseMermaid so the dispatch is covered too.
describe('parseMermaid: ER diagrams', () => {
  it('parses relationships with cardinality onto ends/head, plus labels', () => {
    const r = parseMermaid(`erDiagram
  CUSTOMER ||--o{ ORDER : places
  ORDER ||--|| INVOICE : "billed as"
  CUSTOMER }o--o{ PRODUCT : browses`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.graph.nodes.map((n) => n.id)).toEqual(['CUSTOMER', 'ORDER', 'INVOICE', 'PRODUCT']);
    expect(r.graph.edges).toEqual([
      // one-to-many: crow's foot at the ORDER end.
      { from: 'CUSTOMER', to: 'ORDER', label: 'places', ends: 'to', head: 'cross' },
      // one-to-one: headless.
      { from: 'ORDER', to: 'INVOICE', label: 'billed as', ends: 'none' },
      // many-to-many: both ends.
      { from: 'CUSTOMER', to: 'PRODUCT', label: 'browses', ends: 'both', head: 'cross' },
    ]);
  });

  it('marks the many side when it is on the left', () => {
    const r = parseMermaid('erDiagram\n  ORDER }|--|| CUSTOMER : belongs_to');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.graph.edges[0]).toMatchObject({ ends: 'from', head: 'cross' });
  });

  it('renders non-identifying (dotted) relationships dashed', () => {
    const r = parseMermaid('erDiagram\n  A ||..o{ B : maybe');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.graph.edges[0]).toMatchObject({ line: 'dashed' });
  });

  it('folds attribute blocks into the entity label, dropping keys/comments', () => {
    const r = parseMermaid(`erDiagram
  CUSTOMER {
    string name PK "the customer name"
    int age
  }
  CUSTOMER ||--o{ ORDER : places`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const customer = r.graph.nodes.find((n) => n.id === 'CUSTOMER')!;
    expect(customer.label).toBe('CUSTOMER\nstring name\nint age');
    expect(customer.shape).toBe('square');
  });

  it('accepts bare entity declarations', () => {
    const r = parseMermaid('erDiagram\n  LONELY');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.graph.nodes).toEqual([{ id: 'LONELY', label: 'LONELY', shape: 'square' }]);
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
});
