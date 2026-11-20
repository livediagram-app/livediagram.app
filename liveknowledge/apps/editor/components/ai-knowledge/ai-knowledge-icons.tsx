// AI Knowledge's icons (docs/specs/004-interface-design/iconography.md): vendored Lucide glyphs.
import {
  lucideBell,
  lucideCircleHelp,
  lucideCpu,
  lucideEllipsis,
  lucideGitPullRequest,
  lucideHeartPulse,
  lucideKey,
  lucideLayers,
  lucideLock,
  lucideMail,
  lucidePencilLine,
  lucidePlus,
  lucideScale,
  lucideSquareCode,
  lucideWorkflow,
  lucideX,
} from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@liveknowledge/ui';

export const AgentIcon = lucideGlyph(lucideCpu, 18);
export const McpIcon = lucideGlyph(lucideWorkflow, 18);
export const CliIcon = lucideGlyph(lucideSquareCode, 18);
export const TokenIcon = lucideGlyph(lucideKey, 18);
export const ConflictIcon = lucideGlyph(lucideScale, 18);
export const QuestionIcon = lucideGlyph(lucideCircleHelp, 18);
export const SuggestionIcon = lucideGlyph(lucideGitPullRequest, 18);
export const HealthIcon = lucideGlyph(lucideHeartPulse, 18);
export const ContextIcon = lucideGlyph(lucideLayers, 18);
export const AddIcon = lucideGlyph(lucidePlus, 14);
export const DismissIcon = lucideGlyph(lucideX, 16);
export const MoreIcon = lucideGlyph(lucideEllipsis, 16);
export const AllowWritingIcon = lucideGlyph(lucidePencilLine, 14);
export const StopWritingIcon = lucideGlyph(lucideLock, 14);
export const MailIcon = lucideGlyph(lucideMail, 14);
export const RemindIcon = lucideGlyph(lucideBell, 14);
