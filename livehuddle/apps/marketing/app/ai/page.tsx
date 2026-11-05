import { pageMetadata } from '@livehuddle/ui';
import { BuildWithAi } from '@liveworkspace/marketing-site/components/ai/BuildWithAi';

import { AiCapabilities } from '@/components/ai/AiCapabilities';
import { AiChatArt } from '@/components/ai/AiChatArt';
import { BreadcrumbJsonLd } from '@/components/BreadcrumbJsonLd';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { AI_CLIENTS, AI_PRODUCT, STARTER_PROMPTS } from '@/lib/ai-clients';

// Build with AI (docs/specs/019-marketing/build-with-ai.md): from "I use an AI tool" to "it just set up a Space in
// livehuddle" in the fewest steps. The page is @liveworkspace/marketing-site's BuildWithAi; this route hands it this product's clients, prompts, art and words.

export const metadata = pageMetadata({
  title: 'Build with AI · livehuddle',
  description:
    'Connect Claude, ChatGPT, Cursor, VS Code or any MCP client to livehuddle in a minute, then ask your AI to set up a stand-up, an office or an all-hands Space.',
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
            Connect the AI tool you already use, then ask it for a Team Pod for the stand-up, a
            Virtual Office for the team or an All-Hands Hall for Friday. It lands in your account,
            ready to meet in. Set up takes about a minute.
          </>
        }
        ask="a Team Pod, a Virtual Office or an All-Hands Hall"
        art={<AiChatArt />}
        capabilities={<AiCapabilities />}
        controlLead={
          <>
            Connecting needs a free livehuddle account, so your AI&apos;s work is saved to you. The
            space itself never needs one.
          </>
        }
      />
      <Footer />
    </>
  );
}
