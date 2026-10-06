// The fingerprint line of a refused request (the agent-presence blueprint "Observability"): the caller's fields, the
// status, and the error code the body names; never its text.

export async function logRefusal(
  fingerprint: string,
  res: Response,
  fields: Record<string, unknown>,
): Promise<void> {
  const code = await res
    .clone()
    .json()
    .then((body: unknown) =>
      typeof body === 'object' && body !== null && 'error' in body ? String(body.error) : null,
    )
    .catch(() => null);
  console.warn(fingerprint, { ...fields, status: res.status, code });
}
