// The server-capability probe every editor makes (GET /api/capabilities): which optional features this
// deployment has configured. The answer is deployment config, the same for every caller, so a page asks once
// however many surfaces need it (the editor, the Drive mirror, each Settings open). Fail-closed: a
// failure or an answer that is not OK is `closed` (every feature off), and is not kept, so the next caller
// asks again. Each product binds the factory to its own request funnel and its own `closed` answer.

type CapabilitiesOptions<T> = {
  // The request for `<api base>/capabilities`, through the product's own fetch (its headers and error reporting).
  request: () => Promise<Response>;
  // The answer when the request fails: each feature off.
  closed: T;
};

export type CapabilitiesClient<T> = {
  get: () => Promise<T>;
  // Tests only: a fresh page.
  reset: () => void;
};

export function createCapabilitiesClient<T>(
  options: CapabilitiesOptions<T>,
): CapabilitiesClient<T> {
  let held: Promise<T> | null = null;

  async function ask(): Promise<{ caps: T; ok: boolean }> {
    try {
      const res = await options.request();
      if (!res.ok) return { caps: options.closed, ok: false };
      return { caps: (await res.json()) as T, ok: true };
    } catch {
      return { caps: options.closed, ok: false };
    }
  }

  return {
    get: () => {
      held ??= ask().then(({ caps, ok }) => {
        if (!ok) held = null;
        return caps;
      });
      return held;
    },
    reset: () => {
      held = null;
    },
  };
}
