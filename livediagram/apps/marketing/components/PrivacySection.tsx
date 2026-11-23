// The landing page's Privacy band. The band, its art and the promises are @liveworkspace/marketing-site's
// (components/privacy), the same in every product; what is livediagram's own is what it makes and exports.

import { privacyPromises } from '@liveworkspace/marketing-site/components/privacy/privacy-promises';
import { PrivacySection as Section } from '@liveworkspace/marketing-site/components/privacy/PrivacySection';

const PROMISES = privacyPromises({
  noun: 'diagram',
  exports: 'any tab to PNG, SVG, PDF, Mermaid, Markdown or portable JSON',
  privateNoun: 'canvas',
});

export function PrivacySection() {
  return <Section promises={PROMISES} maker="a diagram editor" />;
}
