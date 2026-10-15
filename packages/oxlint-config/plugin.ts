import { definePlugin, defineRule } from '@oxlint/plugins';
import { NATIVE_TITLE } from '@livediagram/oxlint-config/native-title';
import { RAW_ICON_SVG } from '@livediagram/oxlint-config/raw-svg';

// The repo's own rules, loaded through oxlint's `jsPlugins`. Each reports every node its
// selector matches, with the message that names the primitive to use instead.

type Restriction = { selector: string; message: string };

const restrict = ({ selector, message }: Restriction) =>
  defineRule({
    meta: { type: 'problem', messages: { restricted: message } },
    createOnce: (context) => ({
      [selector]: (node) => context.report({ node, messageId: 'restricted' }),
    }),
  });

export default definePlugin({
  meta: { name: 'livediagram' },
  rules: {
    'no-native-title': restrict(NATIVE_TITLE),
    'no-raw-icon-svg': restrict(RAW_ICON_SVG),
  },
});
