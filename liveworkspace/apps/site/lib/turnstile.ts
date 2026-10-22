// Cloudflare Turnstile on the sign-in pages: the one script this site loads from another origin
// (the Trusted Types boot in app/layout.tsx allows it). Loaded only when a page asks, rendered by
// hand ("explicit"), so the static pages can take the site key from the accounts Worker.

export const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com';
const SCRIPT = `${TURNSTILE_ORIGIN}/turnstile/v0/api.js?render=explicit`;

export interface Turnstile {
  render(container: HTMLElement, options: Record<string, unknown>): string;
  getResponse(widget?: string): string | undefined;
  reset(widget?: string): void;
  remove(widget: string): void;
}

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

let loading: Promise<Turnstile> | null = null;

export function loadTurnstile(): Promise<Turnstile> {
  loading ??= new Promise<Turnstile>((resolve, reject) => {
    if (window.turnstile) return resolve(window.turnstile);
    const script = document.createElement('script');
    script.src = SCRIPT;
    script.async = true;
    script.onload = () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile'));
    script.onerror = () => {
      loading = null;
      reject(new Error('turnstile'));
    };
    document.head.append(script);
  });
  return loading;
}
