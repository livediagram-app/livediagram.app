import { pageMetadata } from '@livedesign/ui';
import { BuildWithAi } from '@liveworkspace/marketing-site/components/ai/BuildWithAi';

import { AiCapabilities } from '@/components/ai/AiCapabilities';
import { AiChatArt } from '@/components/ai/AiChatArt';
import { BreadcrumbJsonLd } from '@/components/BreadcrumbJsonLd';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { AI_CLIENTS, AI_PRODUCT, STARTER_PROMPTS } from '@/lib/ai-clients';

// Build with AI (docs/specs/019-marketing/build-with-ai.md): from "I use an AI tool" to "it just made a design in
// livedesign" in the fewest steps. The page is @liveworkspace/marketing-site's BuildWithAi; this route hands it this product's clients, prompts, art and words.

export const metadata = pageMetadata({
  title: 'Build with AI · livedesign',
  description:
    'Connect Claude, ChatGPT, Cursor, VS Code or any MCP client to livedesign in a minute, then ask your AI for logos and wireframes.',
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
            Connect the AI tool you already use, then ask it for a logo, a wireframe or a whole
            screen flow. It lands in your account, ready to edit together. Set up takes about a
            minute.
          </>
        }
        ask="a logo, a wireframe or a screen flow"
        art={<AiChatArt />}
        capabilities={<AiCapabilities />}
        controlLead={
          <>
            Connecting needs a free livedesign account, so your AI&apos;s work is saved to you. The
            canvas itself never needs one.
          </>
        }
      />
      <Footer />
    </>
  );
}
