// A short session of an agent reading a knowledgebase (docs/specs/019-marketing/build-with-ai.md "The page"):
// three calls to the MCP server and what each hands back. The tool names and the field names are the server's own
// (apps/mcp/src, docs/specs/024-agents/knowledgebase-for-agents.md); lib/ai-clients.test.ts holds the tool names to
// the catalogue. Drawn as text in a terminal card, never a screenshot: the knowledgebase and its pages are made
// up. Static markup; its moving parts (the caret, the connected dot) are CSS loops, and the figure is
// content-visibility: auto, so they rest while it is off screen. Its right and bottom padding hold the card's
// offset shadow inside the figure's own box, where paint containment would otherwise clip it.

import type { ReactNode } from 'react';

/** The tools the transcript calls, in order. Read by the test that checks each against the MCP's own names. */
export const TRANSCRIPT_TOOLS = ['get_context', 'search_pages', 'suggest_edit'] as const;

const KEY = 'text-slate-400';
const VALUE = 'text-slate-100';
const GOOD = 'text-emerald-300';

// A call: the tool and its arguments. `more` is the arguments' second line, for a call too long for one.
function Call({ tool, args, more }: { tool: string; args?: string; more?: string }) {
  return (
    <>
      <p className="mt-4 first:mt-0">
        <span className="text-slate-500 select-none">&gt; </span>
        <span className="font-semibold text-brand-300">{tool}</span>
        <span className="text-slate-300">
          ({args}
          {more ? '' : ')'}
        </span>
      </p>
      {more ? <p className="pl-8 text-slate-300">{more})</p> : null}
    </>
  );
}

// One line of an answer: a field and its value, the field names in a fixed column.
function Field({ name, children }: { name: string; children: ReactNode }) {
  return (
    <p className="flex gap-3 pl-4">
      <span className={`w-28 shrink-0 ${KEY}`}>{name}</span>
      <span className={`min-w-0 ${VALUE}`}>{children}</span>
    </p>
  );
}

export function AgentTranscript() {
  return (
    <figure className="w-full max-w-xl min-w-0 pr-2 pb-2 [contain-intrinsic-size:auto_22rem] [content-visibility:auto]">
      <figcaption className="sr-only">
        An agent calls get_context, search_pages and suggest_edit on a knowledgebase. Each answer
        says how far the page can be trusted, and the edit waits for a person to accept it.
      </figcaption>
      <div className="relative">
        {/* The lime shadow set off down and right, as on every card in the site's art. */}
        <div
          aria-hidden
          className="absolute inset-0 translate-x-2 translate-y-2 rounded-2xl bg-brand-400"
        />
        <div className="relative overflow-hidden rounded-2xl border-2 border-slate-900 bg-slate-900 dark:border-slate-200 dark:bg-slate-950">
          <div className="flex items-center gap-2 border-b border-slate-700 px-4 py-2.5">
            <span
              aria-hidden
              className="h-2 w-2 rounded-full bg-emerald-400 motion-safe:animate-pulse"
            />
            <span className="text-xs font-semibold text-slate-200">Coding Agent</span>
            <span className="text-xs text-slate-400">connected to Acme Handbook</span>
          </div>
          <div className="overflow-x-auto px-4 py-4 font-mono text-[12.5px] leading-[1.65] whitespace-nowrap">
            <Call tool="get_context" />
            <Field name="knowledgebase">Acme Handbook</Field>
            <Field name="scopes">read, suggest</Field>
            <Field name="pages">2 Always in Context, 3,120 of 8,000 tokens</Field>

            <Call tool="search_pages" args={'{ query: "when do we deploy" }'} />
            <Field name="page">Release Runbook</Field>
            <Field name="heading">When We Deploy</Field>
            <Field name="verified">
              <span className={GOOD}>verified</span>, 2026-11-12
            </Field>
            <Field name="stale">false</Field>
            <Field name="passage">Deploys go out Monday to Thursday.</Field>

            <Call
              tool="suggest_edit"
              args={'{ page: "Release Runbook",'}
              more={'reason: "The freeze now starts Thursday at 16:00." }'}
            />
            <Field name="pending">
              1 suggestion, waiting for a person to accept
              <span
                aria-hidden
                className="fa-pulse ml-1 inline-block h-3.5 w-[7px] translate-y-0.5 bg-brand-300"
              />
            </Field>
          </div>
        </div>
      </div>
    </figure>
  );
}
