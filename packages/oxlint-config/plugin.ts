import { definePlugin, defineRule } from '@oxlint/plugins';
import {
  DISABLE_REASON_MESSAGES,
  directiveProblem,
} from '@liveworkspace/oxlint-config/disable-reason';
import { NATIVE_TITLE } from '@liveworkspace/oxlint-config/native-title';
import { RAW_ICON_SVG } from '@liveworkspace/oxlint-config/raw-svg';
import {
  fileSaysNoMemo,
  isBareGet,
  storeGetInRender,
  STORE_GET_IN_RENDER_MESSAGE,
  type AstNode,
} from '@liveworkspace/oxlint-config/store-get-in-render';

// The repo's own rules, loaded through oxlint's `jsPlugins`. Each restriction reports every node its
// selector matches, with the message that names the primitive to use instead.

type Restriction = { selector: string; message: string };

const restrict = ({ selector, message }: Restriction) =>
  defineRule({
    meta: { type: 'problem', messages: { restricted: message } },
    createOnce: (context) => ({
      [selector]: (node) => context.report({ node, messageId: 'restricted' }),
    }),
  });

// A disable directive names its rule and says why (./disable-reason.ts). The comments are read once per file, from
// the Program node: one pass over a file's comments.
const disableReason = defineRule({
  meta: { type: 'problem', messages: DISABLE_REASON_MESSAGES },
  createOnce: (context) => ({
    Program: (program) => {
      for (const comment of program.comments) {
        const problem = comment.type === 'Shebang' ? null : directiveProblem(comment.value);
        if (problem) context.report({ node: comment, messageId: problem });
      }
    },
  }),
});

// A store's .get() while a component or hook renders (./store-get-in-render.ts). A file that says 'use no memo' is
// left alone whole; the check runs only on a bare `.get()`, so a file's other calls cost a property read each.
const noStoreGetInRender = defineRule({
  meta: { type: 'problem', messages: { render: STORE_GET_IN_RENDER_MESSAGE } },
  create: (context) => {
    let skip = false;
    return {
      Program: (program) => {
        skip = fileSaysNoMemo(program as unknown as AstNode);
      },
      CallExpression: (node) => {
        const call = node as unknown as AstNode;
        if (!skip && isBareGet(call) && storeGetInRender(call))
          context.report({ node, messageId: 'render' });
      },
    };
  },
});

export default definePlugin({
  meta: { name: 'liveworkspace' },
  rules: {
    'disable-reason': disableReason,
    'no-native-title': restrict(NATIVE_TITLE),
    'no-raw-icon-svg': restrict(RAW_ICON_SVG),
    'no-store-get-in-render': noStoreGetInRender,
  },
});
