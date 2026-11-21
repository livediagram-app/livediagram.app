// The Automations card's art: the shared Automations screen (packages/marketing-site's feature-art), its Rules tab
// open on three of livedocuments's own templates (livedocuments/docs/specs/013-workspace/automations.md "Templates").

import { AutomationsArt as SharedAutomationsArt } from '@liveworkspace/marketing-site/components/feature-art/automations-screen';

/** Automations: rules a document runs on its own, three of them on. */
export function AutomationsArt() {
  return (
    <SharedAutomationsArt
      rules={[
        {
          name: 'Name a Version Every Friday',
          sentence: 'When Weekly on Friday at 17:00 then Name This Version',
          last: 'Friday',
        },
        {
          name: 'Signed Off',
          sentence: 'When All Threads Resolved then Name This Version',
          last: '3h ago',
        },
        {
          name: 'Comments to Slack',
          sentence: 'When Comment Added then Post to Slack',
          last: '2h ago',
        },
      ]}
    />
  );
}
