// The account avatar's letter. Pure, so every avatar surface and the tests share one answer.

/** The letter on the initials avatar: first name, else username, else '?'. */
export function accountInitial(
  user: { firstName: string | null; username: string | null } | null,
): string {
  return (user?.firstName || user?.username || '?').slice(0, 1).toUpperCase();
}
