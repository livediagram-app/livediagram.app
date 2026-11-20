// The Ask and AI Knowledge chrome's icons (docs/specs/004-interface-design/iconography.md): vendored Lucide glyphs
// at the chrome's sizes.
import {
  lucideArrowUp,
  lucideBookOpen,
  lucideCheck,
  lucideCircleCheck,
  lucideCircleDot,
  lucideCircleHelp,
  lucideClock,
  lucideCopy,
  lucideFilePlus,
  lucideFileText,
  lucideKey,
  lucideLock,
  lucideLogIn,
  lucideMessagesSquare,
  lucidePlus,
  lucideSearch,
  lucideSettings,
  lucideSparkle,
  lucideSparkles,
  lucideSquare,
  lucideThumbsDown,
  lucideThumbsUp,
  lucideTriangleAlert,
  lucideWifi,
  lucideX,
} from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@liveknowledge/ui';

export const PagesViewIcon = lucideGlyph(lucideFileText, 16);
export const AskViewIcon = lucideGlyph(lucideMessagesSquare, 16);
export const AiViewIcon = lucideGlyph(lucideSparkles, 16);

export const SendIcon = lucideGlyph(lucideArrowUp, 16);
export const StopIcon = lucideGlyph(lucideSquare, 14);
export const NewQuestionIcon = lucideGlyph(lucidePlus, 16);
export const QuestionIcon = lucideGlyph(lucideCircleHelp, 16);
export const RecentIcon = lucideGlyph(lucideClock, 16);
export const SourcesIcon = lucideGlyph(lucideBookOpen, 16);
export const PageIcon = lucideGlyph(lucideFileText, 14);
export const VerifiedIcon = lucideGlyph(lucideCircleCheck, 14);
export const WarningIcon = lucideGlyph(lucideTriangleAlert, 14);
export const HelpfulIcon = lucideGlyph(lucideThumbsUp, 14);
export const NotHelpfulIcon = lucideGlyph(lucideThumbsDown, 14);
export const CopyIcon = lucideGlyph(lucideCopy, 14);
export const CopiedIcon = lucideGlyph(lucideCheck, 14);
export const SavePageIcon = lucideGlyph(lucideFilePlus, 14);
export const KeyIcon = lucideGlyph(lucideKey, 16);
// Generic marks for the two providers of AI Settings: never a company's logo.
export const ProviderSparkIcon = lucideGlyph(lucideSparkle, 16);
export const ProviderRingIcon = lucideGlyph(lucideCircleDot, 16);
export const SettingsIcon = lucideGlyph(lucideSettings, 16);
export const SearchIcon = lucideGlyph(lucideSearch, 16);
export const SignInIcon = lucideGlyph(lucideLogIn, 16);
export const OfflineIcon = lucideGlyph(lucideWifi, 16);
export const LockIcon = lucideGlyph(lucideLock, 16);
export const CloseIcon = lucideGlyph(lucideX, 16);
