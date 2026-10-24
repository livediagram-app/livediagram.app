'use client';

import type { SettingsIllustrationProps, SettingsUiKit } from '@liveworkspace/settings-ui';
import { DialogCloseButton, Glyph, NoMatches } from '@livedocuments/ui';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { SearchInput } from '@/components/primitives/SearchInput';
import type { HelpArticleKey } from '@/lib/help-articles';
import { SettingsIllustration, type SettingsIllustrationId } from './settings-illustrations';
import { SettingsSignInLink } from './SettingsSignInLink';

// What the shared Settings view (@liveworkspace/settings-ui) borrows from this editor: its glyphs,
// search box, close button, help links, Sign In link and illustrations.
export const SETTINGS_KIT: SettingsUiKit = {
  Glyph,
  SearchInput,
  CloseButton: ({ onClick }) => <DialogCloseButton compact onClick={onClick} />,
  NoMatches,
  HelpLink: ({ article }) => <HelpArticleLink article={article as HelpArticleKey} variant="text" />,
  SignInLink: SettingsSignInLink,
  Illustration: ({ id, ...rest }: SettingsIllustrationProps) => (
    <SettingsIllustration id={id as SettingsIllustrationId} {...rest} />
  ),
};
