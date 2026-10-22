// Plan cards as formulas read them (docs/specs/029-sheets/formulas.md "Plan cards"). Structural, so the engine never
// imports the items package: the editor, the api and MCP build a CardSource from the document's items and types.
import type { Scalar } from './formula/values';

export type CardRow = { key: number };

export type CardSource = {
  // Every live card (not archived, not in the Trash), in key order.
  cards(): readonly CardRow[];
  // A field of a card by the name the card panel uses (case ignored): its value, or undefined when no such field.
  fieldOf(card: CardRow, name: string): Scalar | undefined;
  // Whether a field name is known at all (an unknown one is #NAME?).
  knowsField(name: string): boolean;
  // Raised whenever the cards change, so card readers recalculate.
  version: number;
};
