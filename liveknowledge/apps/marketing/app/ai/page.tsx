import { BuildWithAi } from '@liveworkspace/marketing-site/components/ai/BuildWithAi';

import { AiCapabilities } from '@/components/ai/AiCapabilities';
import { AgentTranscript } from '@/components/ai/AgentTranscript';
import { BreadcrumbJsonLd } from '@/components/BreadcrumbJsonLd';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { AI_CLIENTS, AI_PRODUCT, STARTER_PROMPTS } from '@/lib/ai-clients';
import { pageMetadata } from '@/lib/seo';

// Build with AI (docs/specs/019-marketing/build-with-ai.md): from "I use an AI tool" to "my agent just answered from
// our knowledgebase" in the fewest steps. The page is @liveworkspace/marketing-site's BuildWithAi; this route hands it this product's clients, prompts, art and words.

export const metadata = pageMetadata({
  title: 'Build with AI · liveknowledge',
  description:
    'Connect Claude, ChatGPT, Cursor, VS Code or any MCP client to your liveknowledge knowledgebase: cited passages with who verified them and when.',
  path: '/ai',
});

export default function BuildWithAiPage() {
  return (
    <>
      <BreadcrumbJsonLd name="Build with AI" path="/ai" />
      <Header surface="Ai" />
      <BuildWithAi
        {...AI_PRODUCT}
        clients={AI_CLIENTS}
        prompts={STARTER_PROMPTS}
        heroLede={
          <>
            Connect the AI tool you already use, then ask it what your knowledgebase says. It reads
            your pages in passages, each with who verified it and when, and suggests edits for a
            person to accept. Set up takes about a minute.
          </>
        }
        ask="a question your knowledgebase answers, or a page to write"
        art={<AgentTranscript />}
        capabilities={<AiCapabilities />}
        controlLead={
          <>
            Connecting needs a free liveknowledge account, so your agent reads only what you can
            open. Writing a page yourself never needs one.
          </>
        }
      />
      <Footer />
    </>
  );
}
