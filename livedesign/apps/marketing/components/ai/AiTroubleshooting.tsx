// If it doesn't connect (docs/specs/019-marketing/build-with-ai.md "The page" 7): the help article's failure lines,
// as native disclosures so every answer is in the static HTML.
const ISSUES = [
  {
    q: 'The page says the request has expired',
    a: 'A connection request lasts ten minutes. Start the connection again from your AI tool.',
  },
  {
    q: 'It says I have reached my limit of API tokens',
    a: 'You can have ten unexpired tokens. Revoke one in Settings › Account › API Tokens, then connect again.',
  },
  {
    q: 'My tool keeps asking me to sign in',
    a: 'The token it held may have expired (they last six months) or been revoked. Remove the connection in your tool and add it again.',
  },
  {
    q: 'I run my own livedesign',
    a: 'Use your own MCP host in place of mcp.livedesign.app, still ending in /mcp. The MCP server is optional and needs accounts set up on your deployment.',
  },
];

export function AiTroubleshooting() {
  return (
    <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-700 dark:bg-slate-900">
      {ISSUES.map(({ q, a }) => (
        <details key={q} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-slate-900 dark:text-slate-100">
            {q}
            <span
              aria-hidden
              className="text-slate-400 transition-transform group-open:rotate-45 motion-reduce:transition-none"
            >
              +
            </span>
          </summary>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{a}</p>
        </details>
      ))}
    </div>
  );
}
