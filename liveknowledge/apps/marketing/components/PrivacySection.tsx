// The landing page's Privacy band. The band, its art and the promises are @liveworkspace/marketing-site's
// (components/privacy), the same in every product; what is liveknowledge's own is what it makes, exports and
// says about Ask and agents.

import { privacyPromises } from '@liveworkspace/marketing-site/components/privacy/privacy-promises';
import { PrivacySection as Section } from '@liveworkspace/marketing-site/components/privacy/PrivacySection';

const PROMISES = privacyPromises({
  noun: 'page',
  exports:
    'any page to Markdown, PDF or Word, or a whole knowledgebase as a folder of Markdown from the command line',
  privateNoun: 'knowledgebase',
  neverSoldExtra:
    'Ask sends passages only to built-in AI (Cloudflare Workers AI) or, if you or your team added a key, to Claude or OpenAI, whichever it chose.',
  privateExtra: 'An agent sees only what the person or token it acts for can open.',
  stack: 'editor, API, MCP server, this site',
  titleCase: true,
});

export function PrivacySection() {
  return <Section promises={PROMISES} maker="a knowledgebase" />;
}
