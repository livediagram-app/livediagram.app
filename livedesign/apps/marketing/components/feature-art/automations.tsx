// The Automations card's art: the shared Automations screen (packages/marketing-site's feature-art), its Rules tab
// open on three of livedesign's own templates (livedesign/docs/specs/013-workspace/automations.md "Templates").

import { AutomationsArt as SharedAutomationsArt } from '@liveworkspace/marketing-site/components/feature-art/automations-screen';

/** Automations: rules a design runs on its own, three of them on. */
export function AutomationsArt() {
  return (
    <SharedAutomationsArt
      rules={[
        {
          name: 'Feedback to Slack',
          sentence: 'When Comment Added then Post to Slack',
          last: '2h ago',
        },
        {
          name: 'Library Updated',
          sentence: 'When Component Changed then Post to Slack',
          last: 'Yesterday',
        },
        {
          name: 'Snapshot Every Friday',
          sentence: 'When Weekly on Friday at 17:00 then Take Snapshot',
          last: 'Friday',
        },
      ]}
    />
  );
}
