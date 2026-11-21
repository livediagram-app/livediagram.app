// The landing page's Privacy band. The band and its art are @liveworkspace/marketing-site's
// (components/privacy); the promises are this product's own words.

import {
  DataIsYoursArt,
  EncryptedArt,
  NoSaleArt,
  NoTrackersArt,
  OpenSourceArt,
  PrivateByDefaultArt,
} from '@liveworkspace/marketing-site/components/privacy/PrivacyArt';
import {
  PrivacySection as Section,
  type PrivacyPromise,
} from '@liveworkspace/marketing-site/components/privacy/PrivacySection';

const PROMISES: PrivacyPromise[] = [
  {
    title: 'No Third-Party Analytics',
    description:
      'No Google Analytics. No Segment. No marketing pixels. The only product telemetry is anonymous, first-party events sent to our own liveworkspace telemetry service, with every event we measure listed publicly on /telemetry.',
    art: <NoTrackersArt />,
  },
  {
    title: 'Your Pages Are Yours',
    description:
      "Export any page to Markdown, PDF or Word whenever you like, or a whole knowledgebase as a folder of Markdown from the command line, and delete your account from settings to remove everything in one go. We don't make money by holding your pages hostage.",
    art: <DataIsYoursArt noun="page" />,
  },
  {
    title: 'Never Sold, Never Traded',
    description:
      "We don't sell your data. We don't trade it. We don't share it with advertisers or model trainers or anyone else. Ask sends passages to Claude or OpenAI, whichever your team chose, only under your team's own key. With no key, Describe to Set Up sends only what you describe, and the titles of pages already there, to Cloudflare Workers AI.",
    art: <NoSaleArt />,
  },
  {
    title: 'Encrypted at Rest and in Transit',
    description:
      'Everything is stored on Cloudflare, which encrypts it at rest, and every request travels over TLS. A team’s Claude or OpenAI key is encrypted again before it is stored, and is never sent back to a browser.',
    art: <EncryptedArt />,
  },
  {
    title: 'Private by Default',
    description:
      'A new knowledgebase is visible only to you until you share it. Share links are unguessable codes you choose to hand out, at the role you pick, and you can revoke one at any time. An agent sees only what the person or token it acts for can open.',
    art: <PrivateByDefaultArt />,
  },
  {
    title: 'Open Source, Auditable',
    description:
      'The whole stack (editor, API, MCP server, this site) is on GitHub under the MIT licence. Anything we claim here, you can read in the source.',
    art: <OpenSourceArt />,
  },
];

export function PrivacySection() {
  return <Section promises={PROMISES} maker="a knowledgebase" />;
}
