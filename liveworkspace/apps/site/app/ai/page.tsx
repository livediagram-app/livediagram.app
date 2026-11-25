import { BuildWithAi } from '@liveworkspace/marketing-site/components/ai/BuildWithAi';
import type { Metadata } from 'next';
import { AiAppCapabilities } from '@/components/ai/AiAppCapabilities';
import { AiChatArt } from '@/components/ai/AiChatArt';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { AI_CLIENTS, AI_PRODUCT, STARTER_PROMPTS } from '@/lib/ai';

// Build with AI (liveworkspace/docs/specs/010-site/site.md "Build with AI"): the one MCP's front door, for every app
// at once. The page is @liveworkspace/marketing-site's BuildWithAi, as on each product's /ai; this route hands it
// liveworkspace's clients, cross-app prompts, art and words. `data-platform-ramp` paints its brand ramp in the
// platform's slate (globals.css).

const TITLE = 'Build with AI · liveworkspace';
const DESCRIPTION =
  'Connect Claude, ChatGPT, Cursor, VS Code or any MCP client to every liveworkspace app at once, then ask for work that starts in one app and finishes in another.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/ai' },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: '/ai',
    siteName: 'liveworkspace',
    type: 'website',
  },
  twitter: { card: 'summary', title: TITLE, description: DESCRIPTION },
};

export default function BuildWithAiPage() {
  return (
    <>
      <Header />
      <div data-platform-ramp="">
        <BuildWithAi
          helpGuide="/help/account-and-data/connect-ai-mcp/ai-clients/"
          {...AI_PRODUCT}
          clients={AI_CLIENTS}
          prompts={STARTER_PROMPTS}
          heroLede={
            <>
              Connect the AI tool you already use once, and it works in every liveworkspace app. One
              request can start in one app and finish in another, and it all lands in your account,
              ready to edit together.
            </>
          }
          ask="a plan, a diagram, a deck or a page of your knowledgebase"
          art={<AiChatArt />}
          capabilitiesTitle="Every app, one connection"
          capabilities={<AiAppCapabilities />}
          promptsLead="Connected? Each of these starts in one app and finishes in another, and names both, so your tool picks the right one. Paste one in, or ask in your own words."
          crossApp={false}
          signUpHref="/sign-up"
          controlLead={
            <>
              Connecting needs a free liveworkspace account, the one you use in every app, so your
              AI&apos;s work is saved to you.
            </>
          }
        />
      </div>
      <Footer />
    </>
  );
}
