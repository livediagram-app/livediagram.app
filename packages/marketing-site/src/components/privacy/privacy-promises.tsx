// The landing page's privacy promises, the same six in every product but for a few words of its own. Written once
// here, so a promise that changes (the AI one, say) changes in every product together, and every claim in them is
// one the privacy policy (liveworkspace/apps/site/app/privacy) makes and the code keeps. Each product's
// components/PrivacySection.tsx hands this its noun, what it exports and what its last card says.

import {
  DataIsYoursArt,
  EncryptedArt,
  NoSaleArt,
  NoTrackersArt,
  OpenSourceArt,
  PrivateByDefaultArt,
} from './PrivacyArt';
import type { PrivacyPromise } from './PrivacySection';

export interface PrivacyPromiseOptions {
  /** What a person makes here, as the art says it ("diagram", "plan", "page"). */
  noun: string;
  /** The formats a person can export to, as the words after "Export" ("any tab to PNG, SVG, PDF or JSON"). */
  exports: string;
  /** What a new one is called in "A new ___ is visible only to you" (defaults to the noun). */
  privateNoun?: string;
  /** What the product adds to the Private card (liveknowledge's note on agents). */
  privateExtra?: string;
  /** What the product adds to the Never sold card (liveknowledge's note on where Ask sends passages). */
  neverSoldExtra?: string;
  /** The parts of the stack the open source card names ("editor, API, this site"). */
  stack?: string;
  /** The last card, in place of Open source (liveplanner's No ads). */
  last?: PrivacyPromise;
  /** Titles in Title Case (liveknowledge's house style) rather than sentence case. */
  titleCase?: boolean;
}

function capital(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** The six promises, in the order the band draws them. */
export function privacyPromises(options: PrivacyPromiseOptions): PrivacyPromise[] {
  const { noun, exports, titleCase } = options;
  const title = (sentence: string, cased: string): string => (titleCase ? cased : sentence);
  const privateNoun = options.privateNoun ?? noun;
  const sold = options.neverSoldExtra ? ` ${options.neverSoldExtra}` : '';
  const priv = options.privateExtra ? ` ${options.privateExtra}` : '';
  const openSource: PrivacyPromise = {
    title: title('Open source, auditable', 'Open Source, Auditable'),
    description: `The whole stack (${options.stack ?? 'editor, API, this site'}) is on GitHub under the MIT licence. Anything we claim here, you can read in the source.`,
    art: <OpenSourceArt />,
  };
  return [
    {
      title: title('No third-party analytics', 'No Third-Party Analytics'),
      description:
        'No Google Analytics. No Segment. No marketing pixels. The only product telemetry is anonymous, first-party events sent to our own liveworkspace telemetry service, with every event we measure listed publicly on /telemetry.',
      art: <NoTrackersArt />,
    },
    {
      title: title('Your data is yours', `Your ${capital(noun)}s Are Yours`),
      description: `Export ${exports} whenever you like. Delete your account from Settings and everything you own goes with it (work that belongs to a team stays with the team). We don't make money by holding it hostage.`,
      art: <DataIsYoursArt noun={noun} />,
    },
    {
      title: title('Never sold, never traded', 'Never Sold, Never Traded'),
      description: `We don't sell your data, we don't trade it, and we don't use it to train AI models. AI features run only when you use them, and the privacy policy names every service that handles your data and why.${sold}`,
      art: <NoSaleArt />,
    },
    {
      title: title('Encrypted at rest and in transit', 'Encrypted at Rest and in Transit'),
      description:
        'Everything is stored on Cloudflare, which encrypts it at rest, and every request travels over TLS. An AI key you add is encrypted again before it is stored, and is never sent back to a browser.',
      art: <EncryptedArt />,
    },
    {
      title: title('Private by default', 'Private by Default'),
      description: `A new ${privateNoun} is visible only to you until you share it. Share links are unguessable codes you choose to hand out: protect them with a password, set them to expire automatically after a week, a month, or six months, or revoke them at any time, instantly disconnecting anyone currently using one.${priv}`,
      art: <PrivateByDefaultArt />,
    },
    options.last ?? openSource,
  ];
}
