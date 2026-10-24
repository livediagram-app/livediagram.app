import { lucideEye, lucideKey, lucideShieldCheck, lucideCpu } from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@livediagram/ui';

// In your control (docs/specs/019-marketing/build-with-ai.md "The page" 6): the trust facts, each one true of the
// shipped MCP server (docs/specs/015-api/mcp-server.md §3, §4.11).
const FACTS = [
  {
    icon: lucideGlyph(lucideShieldCheck, 18),
    title: 'You approve every connection',
    body: 'The approval page says exactly which site the access goes to. Nothing connects until you choose Connect.',
  },
  {
    icon: lucideGlyph(lucideEye, 18),
    title: 'Read-only, if you prefer',
    body: 'Switch on Read-only access and the AI can find and read your documents, but never change them. Our server enforces it.',
  },
  {
    icon: lucideGlyph(lucideKey, 18),
    title: 'Revoke it any time',
    body: 'Each connection is an API token named after the tool, in Settings › Account › API Tokens, and lasts six months. Revoke it and access stops at once.',
  },
  {
    icon: lucideGlyph(lucideCpu, 18),
    title: 'Your AI does the thinking',
    body: 'livediagram runs no AI model of its own here. It checks, lays out and saves what your tool asks for.',
  },
];

export function AiControl() {
  return (
    <ul className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
      {FACTS.map(({ icon: Icon, title, body }) => (
        <li key={title} className="flex gap-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-brand-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-brand-300 dark:ring-slate-700">
            <Icon aria-hidden />
          </span>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {body}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
