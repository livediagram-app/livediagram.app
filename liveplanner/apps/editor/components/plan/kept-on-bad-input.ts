// A number box holding text it can't read as a number ("£12", "12 kg": some browsers let letters in) reads as empty;
// that puts the stored value back rather than clearing it. True when it did. Shared by the Number and Currency field
// boxes (CustomFieldEditor.tsx) and the column's WIP limit (PlanColumnFields.tsx).
export function keptOnBadInput(input: HTMLInputElement, value: unknown): boolean {
  if (!input.validity.badInput) return false;
  input.value = typeof value === 'number' ? String(value) : '';
  return true;
}
