// Repositories in a sentence (docs/specs/026-plan/automations.md "GitHub triggers"): the trigger panel's "Hears …"
// and the Rules list's Needs Attention line. Pure.

/** "acme/web", "acme/web and acme/api", "acme/web, acme/api and 2 more". */
export function heardRepositories(names: readonly string[]): string {
  if (names.length <= 2) return names.join(' and ');
  return `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`;
}
