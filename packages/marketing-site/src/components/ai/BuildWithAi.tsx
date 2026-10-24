import { lucideArrowRight } from '@liveworkspace/icons/lucide';
import { buttonClassName, ButtonContent, lucideGlyph } from '@liveworkspace/ui';
import type { ReactNode } from 'react';

import type { AiClient, AiProduct, StarterPrompt } from '../../lib/ai-clients';
import { BAND_LEAD, BAND_SECTION, BAND_TITLE } from '../../lib/band-classes';
import { EYEBROW } from '../../lib/eyebrow';
import { AiControl } from './AiControl';
import { AiTroubleshooting } from './AiTroubleshooting';
import { ClientPicker } from './ClientPicker';
import { HowItWorks } from './HowItWorks';
import { McpAddressCard } from './McpAddressCard';
import { StarterPrompts } from './StarterPrompts';

// Build with AI (docs/specs/019-marketing/build-with-ai.md, in each product): from "I use an AI tool" to "it just
// made one in the product" in the fewest steps. One client island (the picker and the copy buttons); the rest is
// static. The page's <main>: the app's route wraps it in its header and footer and hands over what is its own (its
// clients, prompts, art, capabilities and the few sentences that say what it makes).

const ArrowIcon = lucideGlyph(lucideArrowRight, 16);
const HELP_GUIDE = '/help/account-and-data/connect-ai-mcp/ai-clients/';

export type BuildWithAiProps = AiProduct & {
  /** The product's clients, from aiClients(product). */
  clients: readonly AiClient[];
  prompts: readonly StarterPrompt[];
  /** The hero's lede: what to ask for, and that it lands in your account. */
  heroLede: ReactNode;
  /** What the third How-it-works step asks for ("a diagram, a whiteboard or a workshop"). */
  ask: string;
  /** The picture of it working, beside the hero copy. */
  art: ReactNode;
  /** What it can do: the product's building blocks. */
  capabilities: ReactNode;
  /** In your control: why connecting needs an account, and what never does. */
  controlLead: ReactNode;
};

function SectionHead({
  id,
  eyebrow,
  title,
  lead,
}: {
  id: string;
  eyebrow: string;
  title: string;
  lead: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className={EYEBROW}>{eyebrow}</p>
      <h2 id={id} className={BAND_TITLE}>
        {title}
      </h2>
      <p className={BAND_LEAD}>{lead}</p>
    </div>
  );
}

export function BuildWithAi({
  name,
  mcpUrl,
  hostedMcpHost,
  clients,
  prompts,
  heroLede,
  ask,
  art,
  capabilities,
  controlLead,
}: BuildWithAiProps) {
  return (
    <main>
      {/* Hero: what it is, the one address, and the picture of it working. */}
      <section
        aria-labelledby="ai-title"
        className="relative overflow-hidden border-b border-slate-200/70 bg-gradient-to-b from-brand-50/80 via-brand-50/30 to-transparent dark:border-slate-800/70 dark:from-brand-500/10 dark:via-brand-500/5"
      >
        <span
          aria-hidden
          className="absolute inset-0 [background-image:radial-gradient(color-mix(in_srgb,var(--color-brand-500)_12%,transparent)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]"
        />
        <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 pt-14 pb-16 sm:px-6 sm:pt-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:pb-20">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold tracking-wide text-brand-700 uppercase ring-1 ring-brand-100 dark:bg-slate-900 dark:text-brand-300 dark:ring-brand-500/20">
              Build with AI
            </p>
            <h1
              id="ai-title"
              className="mt-4 text-4xl font-semibold tracking-tight text-balance text-slate-900 sm:text-5xl dark:text-slate-100"
            >
              Your AI, building in {name}
            </h1>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-slate-600 dark:text-slate-300">
              {heroLede}
            </p>
            <div className="mt-8">
              <McpAddressCard mcpUrl={mcpUrl} />
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href="#connect"
                className={buttonClassName({ size: 'cta', className: 'shadow-sm' })}
              >
                <ButtonContent>Pick your AI tool</ButtonContent>
                <ArrowIcon aria-hidden />
              </a>
              <a
                href="#how-it-works"
                className={buttonClassName({ variant: 'secondary', size: 'cta' })}
              >
                <ButtonContent>How it works</ButtonContent>
              </a>
            </div>
            <p className="mt-5 text-sm text-slate-500 dark:text-slate-400">
              Works with Claude, ChatGPT, Claude Code, Codex, Gemini CLI, Cursor, VS Code, Windsurf
              and any MCP client. Free, with a free account you can make while you connect.
            </p>
          </div>
          <div className="flex justify-center lg:justify-end">{art}</div>
        </div>
      </section>

      <section
        id="how-it-works"
        aria-labelledby="how-title"
        className="scroll-mt-24 px-4 py-16 sm:px-6 sm:py-20"
      >
        <div className="mx-auto max-w-6xl">
          <SectionHead
            id="how-title"
            eyebrow="How it works"
            title="Three steps, about a minute"
            lead="One address, one approval, then you just ask. There is nothing to install or run on your computer."
          />
          <div className="mt-12">
            <HowItWorks name={name} ask={ask} />
          </div>
        </div>
      </section>

      <section
        id="connect"
        aria-labelledby="connect-title"
        className={`scroll-mt-18 px-4 py-16 sm:px-6 sm:py-20 ${BAND_SECTION}`}
      >
        <div className="mx-auto max-w-6xl">
          <SectionHead
            id="connect-title"
            eyebrow="Connect"
            title="Pick your AI tool"
            lead={`Step-by-step for the tools people use most. Choose yours, follow the steps, and approve when ${name} asks.`}
          />
          <div className="mt-12">
            <ClientPicker clients={clients} />
          </div>
        </div>
      </section>

      <section
        id="prompts"
        aria-labelledby="prompts-title"
        className="scroll-mt-24 px-4 py-16 sm:px-6 sm:py-20"
      >
        <div className="mx-auto max-w-6xl">
          <SectionHead
            id="prompts-title"
            eyebrow="Try it"
            title="Your first prompts"
            lead={`Connected? Paste one of these into your AI tool, or ask in your own words. Mentioning ${name} helps it pick the right tool.`}
          />
          <div className="mt-12">
            <StarterPrompts prompts={prompts} />
          </div>
        </div>
      </section>

      <section
        aria-labelledby="can-title"
        className="border-t border-slate-200/70 bg-gradient-to-b from-brand-50/50 to-transparent px-4 py-16 sm:px-6 sm:py-20 dark:border-slate-800/70 dark:from-brand-500/5"
      >
        <div className="mx-auto max-w-6xl">
          <SectionHead
            id="can-title"
            eyebrow="What it can do"
            title={`Everything you make in ${name}`}
            lead="Your AI gets the same building blocks you have in the editor, and everything it makes is yours to change."
          />
          <div className="mt-12">{capabilities}</div>
        </div>
      </section>

      <section
        aria-labelledby="control-title"
        className={`px-4 py-16 sm:px-6 sm:py-20 ${BAND_SECTION}`}
      >
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <div>
            <p className={EYEBROW}>In your control</p>
            <h2 id="control-title" className={BAND_TITLE}>
              Safe to connect
            </h2>
            <p className={BAND_LEAD}>{controlLead}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="/get-started"
                className={buttonClassName({ size: 'cta-sm', className: 'shadow-sm' })}
              >
                <ButtonContent>Create a free account</ButtonContent>
              </a>
              <a
                href={HELP_GUIDE}
                className={buttonClassName({ variant: 'secondary', size: 'cta-sm' })}
              >
                <ButtonContent>Read the full guide</ButtonContent>
              </a>
            </div>
          </div>
          <AiControl name={name} />
        </div>
      </section>

      <section aria-labelledby="trouble-title" className="px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-3xl">
          <h2
            id="trouble-title"
            className="text-center text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100"
          >
            If it doesn&apos;t connect
          </h2>
          <div className="mt-8">
            <AiTroubleshooting name={name} hostedMcpHost={hostedMcpHost} />
          </div>
          <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-300">
            Still stuck? The{' '}
            <a
              href={HELP_GUIDE}
              className="font-medium text-brand-700 underline-offset-2 hover:underline dark:text-brand-300"
            >
              Connecting AI Tools guide
            </a>{' '}
            covers every tool in more depth, or{' '}
            <a
              href="/help/contact/"
              className="font-medium text-brand-700 underline-offset-2 hover:underline dark:text-brand-300"
            >
              get in touch
            </a>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
