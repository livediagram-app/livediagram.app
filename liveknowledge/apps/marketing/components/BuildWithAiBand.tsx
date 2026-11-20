import { ChevronRightIcon } from '@liveknowledge/ui';
import { CtaLink } from '@liveworkspace/marketing-site/components/CtaLink';
import { EYEBROW } from '@liveworkspace/marketing-site/lib/eyebrow';

import { AgentTranscript } from '@/components/ai/AgentTranscript';

// The landing page's Build With AI band (docs/specs/019-marketing/marketing-site.md "Structure" 5): what the MCP
// server and the command line give an agent, beside a transcript of three calls, and the way to /ai, where each
// AI tool's setup is. The tools named here are the MCP server's own (apps/mcp/src).
const TOOLS = ['get_context', 'search_pages', 'read_page', 'suggest_edit', 'report_gap'];

export function BuildWithAiBand() {
  return (
    <section
      id="build-with-ai"
      aria-labelledby="build-with-ai-title"
      className="scroll-mt-20 border-t border-slate-200/70 bg-white dark:border-slate-800/70 dark:bg-slate-900"
    >
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] items-center gap-10 px-6 py-16 sm:py-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-14">
        <div className="enter-on-scroll">
          <p className={EYEBROW}>Build With AI</p>
          <h2
            id="build-with-ai-title"
            className="mt-4 text-3xl font-semibold tracking-tight text-balance text-slate-900 sm:text-4xl dark:text-slate-100"
          >
            Connect the Agents You Already Use
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-pretty text-slate-600 dark:text-slate-300">
            liveknowledge runs no model of its own. Its MCP server and command line hand your agents
            the knowledgebase in pages and passages: the pages you marked Always in Context first,
            then whatever a search finds, each with who verified it and when. An agent sees only
            what the person or token it acts for can open.
          </p>
          <ul aria-label="Tools an agent calls" className="mt-6 flex flex-wrap gap-2">
            {TOOLS.map((tool) => (
              <li
                key={tool}
                className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-[13px] text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                {tool}
              </li>
            ))}
          </ul>
          <CtaLink href="/ai" className="group mt-8">
            Connect an Agent
            <ChevronRightIcon
              size={16}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </CtaLink>
        </div>
        <div className="flex min-w-0 justify-center lg:justify-end">
          <AgentTranscript />
        </div>
      </div>
    </section>
  );
}
