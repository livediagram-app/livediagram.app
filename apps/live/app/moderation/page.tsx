import type { Metadata } from 'next';
import { ModerationPage } from '@/components/moderation/ModerationPage';

// /moderation: the operators' Community moderation page (docs/specs/025-community/community.md
// "Reports and moderation"). Signed in, operator only; the api decides who is an operator, so this
// stays a thin shell around the client page.
export const metadata: Metadata = {
  title: 'Moderation | livediagram',
};

export default function ModerationRoute() {
  return <ModerationPage />;
}
