// Whole elements checked before they are written (docs/specs/015-api/mcp-server.md §4.4 "Values checked"): only the
// elements a liveplanner tab holds (a board, a sheet, a Dashboard's views and charts), and on those the fields an edit
// operation's `set` refuses, refused the same way when the model sends a whole element (create_project, add_tab,
// update_project's replace and its ops `add`). A field the element type does not have and a text size off the scale
// used to be stored and drawn wrong in silence.

import { planElementIssue } from '@liveplanner/edit-operations';
import { withArticle } from '@liveplanner/items';
import { ELEMENT_FIELD_NAMES, fieldValueIssue, type Element } from '@liveplanner/project';

// The fields shown beside an unknown one: those sharing its words, else none.
const NEAREST_FIELDS_MAX = 4;

type Rec = Record<string, unknown>;

const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);

const isElementType = (type: unknown): type is Element['type'] =>
  typeof type === 'string' && Object.hasOwn(ELEMENT_FIELD_NAMES, type);

// The stored fields nearest an unknown one: those holding it, held by it, or sharing its first word.
function fieldsLike(key: string, fields: readonly string[]): string[] {
  const k = key.toLowerCase();
  const head = k.split(/(?=[A-Z])|[-_]/)[0] ?? k;
  return fields
    .filter((f) => {
      const g = f.toLowerCase();
      return g.includes(k) || k.includes(g) || (head.length >= 3 && g.startsWith(head));
    })
    .slice(0, NEAREST_FIELDS_MAX);
}

// Why one element cannot be written as given, or null. `where` names it in the sentence.
function elementIssue(el: Rec, where: string): string | null {
  const notPlan = planElementIssue(el);
  if (notPlan) return `${where}: ${notPlan}; read liveplanner://schema/elements.`;
  if (!isElementType(el.type)) return null; // the validator names a missing or unknown type
  const fields: readonly string[] = ELEMENT_FIELD_NAMES[el.type];
  for (const key of Object.keys(el)) {
    if (fields.includes(key)) continue;
    const like = fieldsLike(key, fields);
    return (
      `${where}: "${key}" is not a field of ${withArticle(el.type)}` +
      (like.length ? `; fields like it: ${like.join(', ')}.` : '.')
    );
  }
  for (const [key, value] of Object.entries(el)) {
    const issue = fieldValueIssue(key, value);
    if (issue) return `${where}: ${issue}.`;
  }
  return null;
}

// The first element in `elements` that cannot be written as given, as a sentence; null when all can.
export function elementsIssue(elements: readonly unknown[]): string | null {
  for (const [i, el] of elements.entries()) {
    if (!isRec(el)) continue;
    const where = typeof el.id === 'string' ? `element "${el.id}"` : `element ${i + 1}`;
    const issue = elementIssue(el, where);
    if (issue) return issue;
  }
  return null;
}
