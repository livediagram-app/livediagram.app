import type { Metadata } from 'next';
import { ChatLinkView } from './ChatLinkView';

// A chat user's account link (docs/specs/030-knowledgebase/chat-apps.md "Linking an account"): the Slack or Teams
// app's Connect button opens it with its code. Kept out of search engines like the rest of the editor app.
export const metadata: Metadata = {
  title: 'Connect Your Account | liveknowledge',
  robots: { index: false },
};

export default function Page() {
  return <ChatLinkView />;
}
