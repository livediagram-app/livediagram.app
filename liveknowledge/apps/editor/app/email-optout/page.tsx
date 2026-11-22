import type { Metadata } from 'next';
import { EmailOptOutView } from './EmailOptOutView';

// A rule email's unsubscribe page (docs/specs/013-workspace/automations.md "Unsubscribing"): the link in every email
// a rule sends to a typed-in address opens it, with the document and the address's token in the query. One button
// unsubscribes; opening the page does nothing, so a mail scanner that follows links unsubscribes nobody. Kept out of
// search engines like the rest of the editor app.
export const metadata: Metadata = {
  title: 'Unsubscribe | liveknowledge',
  robots: { index: false },
};

export default function Page() {
  return <EmailOptOutView />;
}
