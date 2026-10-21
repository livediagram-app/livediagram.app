// Ids for a form's sections and questions (blueprint DEFAULTS D2): a prefix and six base-36 characters.
export function newFormPartId(prefix: 'q' | 's', random: () => number = Math.random): string {
  let id = '';
  for (let i = 0; i < 6; i += 1) id += Math.floor(random() * 36).toString(36);
  return `${prefix}-${id}`;
}
