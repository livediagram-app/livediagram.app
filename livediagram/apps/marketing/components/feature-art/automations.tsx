// The Automations card's art: the shared Automations screen (packages/marketing-site's feature-art), its Rules tab
// open on three of livediagram's own templates (livediagram/docs/specs/013-workspace/automations.md "Templates").

import { AutomationsArt as SharedAutomationsArt } from '@liveworkspace/marketing-site/components/feature-art/automations-screen';

/** Automations: rules a canvas runs on its own, three of them on. */
export function AutomationsArt() {
  return (
    <SharedAutomationsArt
      rules={[
        {
          name: 'Reset Every Night',
          sentence: 'When Every Day at 0:00 then Revert to Snapshot',
          last: 'Today',
        },
        {
          name: 'Comments to Slack',
          sentence: 'When Comment Added then Post to Slack',
          last: '2h ago',
        },
        {
          name: 'Poll Results to Slack',
          sentence: 'When Poll Ended then Post to Slack',
          last: 'Yesterday',
        },
      ]}
    />
  );
}
