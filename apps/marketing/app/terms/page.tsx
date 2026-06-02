import { LegalPage } from '@/components/LegalPage';
import { LEGAL_LAST_UPDATED_DISPLAY } from '@/lib/legal-revisions';
import { subpageMetadata } from '@/lib/subpage-metadata';

const TERMS_TITLE = 'Terms of Service · livediagram';
const TERMS_DESCRIPTION = 'The terms that govern use of the hosted livediagram service.';

export const metadata = subpageMetadata({
  title: TERMS_TITLE,
  description: TERMS_DESCRIPTION,
  path: '/terms',
});

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" path="/terms" lastUpdated={LEGAL_LAST_UPDATED_DISPLAY}>
      <p>
        These terms cover your use of the hosted livediagram service at{' '}
        <strong>livediagram.app</strong> (the &ldquo;Service&rdquo;), operated by the livediagram
        team (&ldquo;we&rdquo;, &ldquo;us&rdquo;). By using the Service you agree to these terms. If
        you do not agree, please do not use the Service.
      </p>

      <h2>The software is open source</h2>
      <p>
        livediagram&rsquo;s source code is public and MIT-licensed. You are free to read it, fork
        it, and run your own copy. These terms govern only the hosted Service we operate at
        livediagram.app. They do not apply to a copy you host yourself.
      </p>

      <h2>Using the Service</h2>
      <p>
        You can create and edit diagrams without an account. Some features, such as syncing across
        devices, may ask you to sign in. You are responsible for the activity that happens under
        your account and for keeping your sign-in details secure.
      </p>

      <h2>Your content</h2>
      <p>
        You own the diagrams and content you create. We do not claim ownership of it. You grant us
        the limited permission we need to store, process, and display your content so that we can
        provide the Service to you and to the people you share it with. You are responsible for the
        content you create and for making sure you have the right to use anything you add to a
        diagram.
      </p>

      <h2>Sharing</h2>
      <p>
        When you create a share link, anyone with that link can open the diagram, and an editor link
        lets them change it. You decide who to give a link to, and you can revoke a link at any
        time. Treat share links like keys.
      </p>

      <h2>Acceptable use</h2>
      <p>Do not use the Service to:</p>
      <ul>
        <li>break the law or infringe someone else&rsquo;s rights;</li>
        <li>store or share malicious, harmful, or illegal content;</li>
        <li>
          attempt to disrupt the Service or gain unauthorised access to it or its infrastructure;
        </li>
        <li>abuse the Service in a way that degrades it for other people.</li>
      </ul>

      <h2>Availability and changes</h2>
      <p>
        We work to keep the Service running, but we provide it &ldquo;as is&rdquo; and &ldquo;as
        available&rdquo;, without warranties of any kind. We may change, suspend, or discontinue any
        part of the Service, and we may update these terms. If we make significant changes we will
        update the date at the top of this page.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the fullest extent allowed by law, we are not liable for any indirect, incidental, or
        consequential damages, or for any loss of data or profits, arising from your use of the
        Service. Because the software is open source, you can always self-host to keep full control
        of your data.
      </p>

      <h2>Termination</h2>
      <p>
        You can stop using the Service at any time. We may suspend or end access where these terms
        are breached.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms? Reach us at{' '}
        <a href="mailto:hello@livediagram.app">hello@livediagram.app</a>.
      </p>
    </LegalPage>
  );
}
