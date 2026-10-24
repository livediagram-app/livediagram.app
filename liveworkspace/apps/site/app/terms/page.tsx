import { lucideGlyph } from '@livediagram/ui';
import {
  lucideDownload,
  lucideGift,
  lucideHandshake,
  lucideScale,
} from '@liveworkspace/icons/lucide';
import type { Metadata } from 'next';
import { LegalPage, type LegalHighlight, type LegalSection } from '@/components/LegalPage';
import { CONTACT_URL, LEGAL_UPDATED } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Terms of Use',
  description:
    'The terms for liveworkspace and its apps (livediagram, liveplanner, livedocuments and livedesign): what you agree to, and what the free service promises.',
  alternates: { canonical: '/terms' },
};

const GiftIcon = lucideGlyph(lucideGift, 20);
const HandshakeIcon = lucideGlyph(lucideHandshake, 20);
const DownloadIcon = lucideGlyph(lucideDownload, 20);
const ScaleIcon = lucideGlyph(lucideScale, 20);

const HIGHLIGHTS: LegalHighlight[] = [
  {
    icon: <GiftIcon />,
    title: 'Completely free',
    body: 'Every app, every feature. No paywalls, no subscriptions.',
  },
  {
    icon: <HandshakeIcon />,
    title: 'Yours to own',
    body: 'You own what you make. We only store and show it for you.',
  },
  {
    icon: <DownloadIcon />,
    title: 'Yours to take',
    body: 'Export your documents, or close your account, any time.',
  },
  {
    icon: <ScaleIcon />,
    title: 'Fair use',
    body: 'Keep it legal, and don’t spoil the apps for anyone else.',
  },
];

// The one set of terms for liveworkspace.app and every app in it (liveworkspace/docs/site.md
// "Privacy and terms"), built from the apps' own terms, which said the same things app by app. What only one
// app does is in that app's section.
const SECTIONS: LegalSection[] = [
  {
    id: 'your-account',
    title: 'Your account',
    body: (
      <>
        <p>
          You can use every app without an account. If you create one, it signs you in to all of
          them. You are responsible for what happens under your account and for keeping access to
          your email address secure, since that is how you sign in. Closing your liveworkspace
          account from any app that uses it closes it for all of them.
        </p>
      </>
    ),
  },
  {
    id: 'your-content',
    title: 'Your content',
    body: (
      <>
        <p>
          You own what you make. We do not claim ownership of it. You grant us the limited
          permission we need to store, process and display it so we can provide the Service to you
          and to the people you share it with. You are responsible for your content, and for having
          the right to use anything you add to it.
        </p>
      </>
    ),
  },
  {
    id: 'sharing',
    title: 'Sharing',
    body: (
      <>
        <p>
          When you create a share link, anyone with it can open the document; an editor link lets
          them change it. You decide who gets a link, you can protect it with a password or an
          expiry, and you can revoke it at any time. Treat share links like keys.
        </p>
      </>
    ),
  },
  {
    id: 'sharing-to-the-community',
    title: 'Sharing to the Community',
    body: (
      <>
        <p>Each app&rsquo;s Community is a public gallery. When you share a document to it:</p>
        <ul>
          <li>
            <strong>It becomes public.</strong> Anyone, with or without an account, can find it,
            view it and make their own copy. Copies are theirs, and stay theirs if you later remove
            your post.
          </li>
          <li>
            <strong>It stays live.</strong> The Community shows the document&rsquo;s latest saved
            version, so later changes are public too, along with its document and tab names.
          </li>
          <li>
            <strong>You choose how you are credited.</strong> Posts are anonymous unless you turn
            that off.
          </li>
          <li>
            <strong>You give us permission to show it publicly</strong> in the Community and in
            places that point to it, for as long as it is shared. You still own it, and you can
            remove it at any time, unless it has been hidden after reports.
          </li>
          <li>
            <strong>Only share what is yours to share.</strong> It must not contain anyone&rsquo;s
            personal information without their permission, and beyond the rules below, it must not
            be spam, advertising, or offensive, hateful, sexual or violent.
          </li>
        </ul>
        <p>
          Anyone can report a post. A post several people report is hidden automatically and for
          good; nobody reviews posts by hand. We may still take down a post where the law requires
          it. If you believe a post infringes your rights, report it or contact us.
        </p>
      </>
    ),
  },
  {
    id: 'api-access',
    title: 'API access',
    body: (
      <>
        <p>
          You can create API tokens on liveworkspace.app to use the apps programmatically. A token
          acts as your account in every app and its MCP server (or only reads, if you make it
          read-only), so keep it secret and revoke any that might have been exposed. You are
          responsible for what is done with your tokens. We may apply rate limits to keep the
          Service healthy. If you connect a third-party or AI tool, you authorise it to act for you
          with that access, until you revoke its token.
        </p>
      </>
    ),
  },
  {
    id: 'communications',
    title: 'Communications',
    body: (
      <>
        <p>
          We send sign-in codes when you ask for them, and, if you have an account, account and
          service emails, notifications about your work and a short onboarding series. You can turn
          off the notifications and onboarding emails in each app&rsquo;s Settings. We do not send
          advertising.
        </p>
      </>
    ),
  },
  {
    id: 'acceptable-use',
    title: 'Acceptable use',
    body: (
      <>
        <p>Do not use the Service to:</p>
        <ul>
          <li>break the law or infringe someone else&rsquo;s rights;</li>
          <li>store or share malicious, harmful or illegal content;</li>
          <li>disrupt the Service or gain unauthorised access to it or its infrastructure;</li>
          <li>abuse it in a way that degrades it for other people.</li>
        </ul>
        <p>
          Good-faith security research that you report to us privately is authorised and does not
          breach these rules.
        </p>
      </>
    ),
  },
  {
    id: 'availability-and-changes',
    title: 'Availability and changes',
    body: (
      <>
        <p>
          The Service is free, with no paywalls or subscriptions. We work to keep it running, but
          provide it &ldquo;as is&rdquo; and &ldquo;as available&rdquo;, without warranties of any
          kind. We may change, suspend or discontinue any part of it, and we may update these terms;
          if we make significant changes, we will update the date at the top.
        </p>
      </>
    ),
  },
  {
    id: 'limitation-of-liability',
    title: 'Limitation of liability',
    body: (
      <>
        <p>
          To the fullest extent allowed by law, we are not liable for any indirect, incidental or
          consequential damages, or for any loss of data or profits, arising from your use of the
          Service. You can export your documents at any time.
        </p>
      </>
    ),
  },
  {
    id: 'termination',
    title: 'Termination',
    body: (
      <>
        <p>
          You can stop using the Service at any time. We may suspend or end access where these terms
          are breached.
        </p>
      </>
    ),
  },
  {
    id: 'contact',
    title: 'Contact',
    body: (
      <>
        <p>
          Questions about these terms? Reach us through our <a href={CONTACT_URL}>contact form</a>.
        </p>
      </>
    ),
  },

  // App by app.
  {
    app: 'livediagram.app',
    id: 'livediagram-software',
    title: 'The software',
    body: (
      <p>
        livediagram&rsquo;s source code is public and MIT-licensed: you are free to read it, fork it
        and run your own copy. These terms cover only the hosted livediagram.app, not a copy you
        host yourself, which is yours to run.
      </p>
    ),
  },
  {
    app: 'liveplanner.app',
    id: 'liveplanner-software',
    title: 'The software',
    body: (
      <p>
        liveplanner&rsquo;s source code is MIT-licensed: you are free to read it, fork it and run
        your own copy. These terms cover only the hosted liveplanner.app, not a copy you host
        yourself, which is yours to run.
      </p>
    ),
  },
  {
    app: 'livedocuments.app',
    id: 'livedocuments-software',
    title: 'The software',
    body: (
      <p>
        livedocuments&rsquo; source code is MIT-licensed: you are free to read it, fork it and run
        your own copy. These terms cover only the hosted livedocuments.app, not a copy you host
        yourself, which is yours to run.
      </p>
    ),
  },
  {
    app: 'livedesign.app',
    id: 'livedesign-software',
    title: 'The software',
    body: (
      <p>
        livedesign&rsquo;s source code is MIT-licensed: you are free to read it, fork it and run
        your own copy. These terms cover only the hosted livedesign.app, not a copy you host
        yourself, which is yours to run.
      </p>
    ),
  },
];

export default function Terms() {
  return (
    <LegalPage
      title="Terms of Use"
      path="/terms"
      updated={LEGAL_UPDATED}
      highlights={HIGHLIGHTS}
      sections={SECTIONS}
      intro={
        <p>
          These terms cover your use of <strong>liveworkspace.app</strong>, including your
          liveworkspace account, and the hosted apps <strong>livediagram.app</strong>,{' '}
          <strong>liveplanner.app</strong>, <strong>livedocuments.app</strong> and{' '}
          <strong>livedesign.app</strong> (together, the &ldquo;Service&rdquo;), operated by the
          liveworkspace team (&ldquo;we&rdquo;, &ldquo;us&rdquo;). By using the Service you agree to
          them. If you do not agree, please do not use it. What only one app does is under{' '}
          <a href="#app-by-app">App by app</a>. They work alongside our{' '}
          <a href="/privacy">Privacy Policy</a>, which explains what the Service does with your
          data.
        </p>
      }
    />
  );
}
