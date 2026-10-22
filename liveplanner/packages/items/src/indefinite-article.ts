// "a" or "an" before a word, by its first sound: a vowel letter takes "an" ("an infographic page", "an Org Chart",
// "an Estimate field"), except where the vowel is said "you" ("a User Persona", "a UML Class", "a unit"). Copy that
// builds a phrase around a name (a page kind, a field, a template, an agent's error) uses it instead of a fixed
// "a". Here, in the dependency-free package, so the editor, the marketing site, the agent verbs and the MCP
// server's messages share one rule; `@liveplanner/project` and `@liveplanner/ui` re-export it.
export function indefiniteArticle(word: string): 'a' | 'an' {
  const w = word.trim();
  return /^[aeiou]/i.test(w) && !/^(us[eiu]|uml|uni|ux)/i.test(w) ? 'an' : 'a';
}

/** The word with its article: `withArticle('infographic')` is "an infographic". */
export const withArticle = (word: string): string => `${indefiniteArticle(word)} ${word}`;
