'use client';

// An install back from Slack (docs/specs/030-knowledgebase/chat-apps.md "Connecting"): `?chat=` on the
// knowledgebase's address opens Slack and Teams saying how it went, once, and leaves the address as it was.
import { useEffect } from 'react';
import { chatReturnOf, openChatAppsWith } from '@/lib/chat-apps/chat-apps-open';

export function ChatReturnWatcher() {
  useEffect(() => {
    const outcome = chatReturnOf(window.location.search);
    if (!outcome) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('chat');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    openChatAppsWith(outcome);
  }, []);
  return null;
}
