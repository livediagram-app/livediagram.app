import { describe, it, expect } from 'vitest';
import { parseMermaid } from './mermaid';
import { layoutClusteredGraph } from './auto-layout-clusters';
import { isValidTab } from './validate';
import { graphToElements } from './graph-authoring';
import { entityHeight } from './data-shapes';

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
      height: entityHeight(2),
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
});
