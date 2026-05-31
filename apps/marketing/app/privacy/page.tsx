import type { Metadata } from 'next';

import { LegalPage } from '@/components/LegalPage';

const PRIVACY_TITLE = 'Privacy Policy · livediagram';
const PRIVACY_DESCRIPTION =
  'What the hosted livediagram service does, and does not do, with your data.';

export const metadata: Metadata = {
  title: PRIVACY_TITLE,
  description: PRIVACY_DESCRIPTION,
  alternates: { canonical: '/privacy' },
  openGraph: {
    type: 'article',
    url: '/privacy',
    siteName: 'livediagram',
    title: PRIVACY_TITLE,
    description: PRIVACY_DESCRIPTION,
    locale: 'en_GB',
  },
  twitter: {
    card: 'summary_large_image',
    title: PRIVACY_TITLE,
    description: PRIVACY_DESCRIPTION,
  },
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated="31 May 2026">
      <p>
        livediagram is built to need as little of your data as possible, and the whole codebase is
        public so you can check that for yourself. This policy explains what the hosted service at{' '}
        <strong>livediagram.app</strong> does with your data. If you self-host livediagram, you are
        responsible for your own deployment and this policy does not apply to it.
      </p>

      <h2>What we store</h2>
      <ul>
        <li>
          <strong>Your diagrams.</strong> The content you create is saved so it is there when you
          come back, and so the people you share it with can see it. It is stored in our database on
          Cloudflare.
        </li>
        <li>
          <strong>A browser id.</strong> If you use livediagram without an account, we keep a random
          identifier in your browser&rsquo;s local storage to link diagrams to your browser. It is
          not tied to your name or email.
        </li>
        <li>
          <strong>Account details, if you sign in.</strong> Sign-in is handled by our authentication
          provider, Clerk. If you create an account we receive your email address, and, if you
          choose Google sign-in, basic profile details from Google. We use these only to identify
          your account.
        </li>
        <li>
          <strong>Basic operational logs.</strong> Our host, Cloudflare, keeps standard request logs
          that help us run the service securely.
        </li>
      </ul>

      <h2>What we do not do</h2>
      <p>
        We do not use tracking pixels, advertising, or third-party analytics SDKs. We do not sell
        your data, and we do not build advertising profiles. There is no hidden telemetry. The
        repository is public, so what runs is what you can read.
      </p>

      <h2>Cookies and local storage</h2>
      <p>
        We use local storage to keep your browser id and your preferences. When you sign in, Clerk
        sets cookies to keep you logged in. We do not use advertising or tracking cookies.
      </p>

      <h2>Service providers</h2>
      <p>We rely on a small number of providers to run the service:</p>
      <ul>
        <li>
          <strong>Cloudflare</strong>, for hosting and database storage.
        </li>
        <li>
          <strong>Clerk</strong>, for authentication (only if you sign in).
        </li>
      </ul>
      <p>These providers process data on our behalf so that we can run the service.</p>

      <h2>Sharing and visibility</h2>
      <p>
        Anything you put on a diagram you share becomes visible to people who have the share link.
        Revoking a link stops further access through it.
      </p>

      <h2>Keeping and deleting your data</h2>
      <p>
        You can delete any diagram you own at any time. You can also delete your account, and the
        data associated with it, yourself from your account settings.
      </p>

      <h2>Children</h2>
      <p>
        livediagram is not directed at children, and we do not knowingly collect data from children.
      </p>

      <h2>Changes</h2>
      <p>
        We may update this policy from time to time. The date at the top of this page reflects the
        latest version.
      </p>

      <h2>Contact</h2>
      <p>
        For privacy questions or requests, reach us at{' '}
        <a href="mailto:hello@livediagram.app">hello@livediagram.app</a>.
      </p>
    </LegalPage>
  );
}
