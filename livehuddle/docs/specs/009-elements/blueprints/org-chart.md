# Org chart: blueprint

Derived from [The org chart](../org-chart.md). Defaults in [DEFAULTS.md](DEFAULTS.md) as `Dn`.

| File                                              | Role                                                       |
| ------------------------------------------------- | ---------------------------------------------------------- |
| `packages/document/src/person-node.ts`            | `mindLook`, initials, the face's layout, the org connector |
| `packages/document/src/svg-render-person-node.ts` | Headless face                                              |
| `packages/document/src/shape-variants.ts`         | The `org-chart` variant on a mind node                     |
| `apps/editor/lib/mind-dress.ts`                     | A grown node takes its map's look; elbow connectors        |
| `apps/editor/components/canvas/PersonNodeFace.tsx`  | Canvas face                                                |

## Domain and naming

| Term        | Identifier                           | Meaning                       |
| ----------- | ------------------------------------ | ----------------------------- |
| Person node | `mindLook: 'person'`, `isPersonNode` | A mind node drawn as a person |
| Role        | `pageSubtitle`                       | The muted line under the name |
| Initials    | `personInitials(name)`               | Up to two capital letters     |

## Behaviour and state

- `personInitials(name)`: words split on whitespace; two or more words take each of the first two words' first
  letter; one word its first two letters; none "?"; upper-cased.
- `personNodeLayout(w, h)`: disc diameter `d = min(44, round(h * 0.7))` at `x = 12`, centred vertically; text column
  from `12 + d + 12` to `w - 10`; name rect the column's top half (or the whole column when there is no role), role
  rect the bottom half.
- Growing (`dressMindNode(node, styleFrom, tab, root)`): when `root.mindLook === 'person'`, the node takes
  `mindLook: 'person'` and no `pageSubtitle` on top of its level's look (the first report of a root also the root's
  size and left alignment). Its connector keeps the mind connector defaults.
- Connectors (`finishMindConnectorRoute`): a default-look connector between two person nodes is routed as the
  Professional finish's bracket (one point on the parent's face, a shared trunk halfway to the nearest child) in every
  finish.
- The `org-chart` variant: a mind node with `mindLook: 'person'`, `mindFlow: 'downward'`, 220 × 64, label "Ana Kim",
  `pageSubtitle` "Head of Engineering", text left-aligned.

### Invariants

- I1: every node grown in a person map is a person node.
- I2: canvas and export place the disc and lines from `personNodeLayout`.

## Interfaces and contracts

```ts
export type MindLook = 'person';
export function isPersonNode(el: Element): boolean;
export function personInitials(name: string): string;
export function personNodeLayout(
  w: number,
  h: number,
  hasRole: boolean,
): { disc: LayoutRect; name: LayoutRect; role: LayoutRect | null };
```

Validation: `mindLook` one of `['person']`.

## Data and persistence

| Field          | Class     | Notes                                 |
| -------------- | --------- | ------------------------------------- |
| `mindLook`     | persisted | Absent = an ordinary mind node        |
| `pageSubtitle` | persisted | The role; shared with the Card's meta |

## Errors and edge cases

| #   | Case                           | Handling                                                                         |
| --- | ------------------------------ | -------------------------------------------------------------------------------- |
| E1  | `mindLook` on a non-mind shape | Ignored by the face; validation refuses on other kinds is not required (lenient) |
| E2  | A very long name               | Ellipsed in its rect                                                             |
| E3  | Node too small for the disc    | The disc shrinks with the height                                                 |

## Security and trust

Text renders as React text and is escaped in export.

## Performance and limits

Rendering is O(1) per node; growing reads the root once (`mindRootOf`).

## Presentation and UX

- D193: 220 × 64; disc 70% of height (≤ 44), soft accent (16%) with accent initials; name semibold at the node's text
  size, role 12 px at 70% opacity; tile "Org Chart" after Mind Node in Build.

## Accessibility

The role line is a `role="textbox"` named "Role".

## Observability

`Element·Added·OrgChart` (the variant's tile).

## Testing

| Rule                      | Test file                                             |
| ------------------------- | ----------------------------------------------------- |
| Initials, layout, variant | `packages/document/src/person-node.test.ts`           |
| Growing (I1), connector   | `apps/editor/lib/mind-dress.test.ts`                    |
| Face and role edit (I2)   | `apps/editor/components/canvas/PersonNodeFace.test.tsx` |

## Constants and configuration

| Name       | Value | Provenance |
| ---------- | ----- | ---------- |
| Disc share | 0.7   | D193       |
| Disc max   | 44    | D193       |
