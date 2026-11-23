// The landing page's Privacy band. The band, its art and the promises are @liveworkspace/marketing-site's
// (components/privacy), the same in every product; what is livehuddle's own is what it makes and exports.

import { privacyPromises } from '@liveworkspace/marketing-site/components/privacy/privacy-promises';
import { PrivacySection as Section } from '@liveworkspace/marketing-site/components/privacy/PrivacySection';

const PROMISES = privacyPromises({
  noun: 'space',
  exports: 'any tab to PNG, SVG, PDF or portable JSON',
  neverSoldExtra:
    'What you say and show in a call is relayed through Cloudflare, never recorded and never stored.',
});

export function PrivacySection() {
  return <Section promises={PROMISES} maker="a meeting app" />;
}
