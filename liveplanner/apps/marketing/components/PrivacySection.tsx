// The landing page's Privacy band. The band, its art and the promises are @liveworkspace/marketing-site's
// (components/privacy), the same in every product; what is liveplanner's own is what it makes and exports,
// and its last card.

import { NoAdsArt } from '@liveworkspace/marketing-site/components/privacy/PrivacyArt';
import { privacyPromises } from '@liveworkspace/marketing-site/components/privacy/privacy-promises';
import { PrivacySection as Section } from '@liveworkspace/marketing-site/components/privacy/PrivacySection';

const PROMISES = privacyPromises({
  noun: 'plan',
  exports: 'a board or a sheet as CSV',
  last: {
    title: 'No ads, anywhere',
    description:
      'liveplanner shows no adverts and runs no ad network, so nothing you plan is ever used to target you. The privacy policy sets out, in plain English, every service that touches your data and why.',
    art: <NoAdsArt />,
  },
});

export function PrivacySection() {
  return <Section promises={PROMISES} maker="a planner" />;
}
