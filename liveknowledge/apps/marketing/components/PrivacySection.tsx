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
    title: 'No third-party analytics',
    description:
      'No Google Analytics. No Segment. No marketing pixels. The only product telemetry is anonymous, first-party events sent to our own liveworkspace telemetry service, with every event we measure listed publicly on /telemetry.',
    art: <NoTrackersArt />,
  },
  {
    title: 'Your data is yours',
    description:
      "Every document lives in your own row, scoped to your owner id. Export any page to PNG, SVG or PDF, or any tab as portable JSON, whenever you like, and delete your account from settings to remove it all in one go. We don't make money by holding it hostage.",
    art: <DataIsYoursArt noun="document" />,
  },
  {
    title: 'Never sold, never traded',
    description:
      "We don't sell your data. We don't trade it. We don't share it with advertisers or model trainers or anyone else. There is no paid tier and no plan to add one, so we have no commercial pressure to monetise what you make.",
    art: <NoSaleArt />,
  },
  {
    title: 'Encrypted at rest and in transit',
    description:
      'All persistence runs on Cloudflare D1 + R2, which encrypt every row and blob at rest with AES-256. Every request is TLS, end to end. The same protections protect telemetry, share links, and uploaded images.',
    art: <EncryptedArt />,
  },
  {
    title: 'Private by default',
    description:
      'A new document is visible only to you until you generate a share link. Share links are unguessable codes you choose to hand out: protect them with a password, set them to expire automatically after a week, a month, or six months, or revoke them at any time, instantly disconnecting anyone currently using one.',
    art: <PrivateByDefaultArt />,
  },
  {
    title: 'Open source, auditable',
    description:
      'The whole stack (editor, API, this site) is on GitHub under the MIT license. Anything we claim here, you can read in the source.',
    art: <OpenSourceArt />,
  },
];

export function PrivacySection() {
  return <Section promises={PROMISES} maker="an editor" />;
}
