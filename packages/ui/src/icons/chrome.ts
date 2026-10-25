// The chrome icons every app draws (docs/specs/004-interface-design/iconography.md): edit actions, navigation,
// status, element badges, the drawing kinds' and modes' marks, the editor's bottom chrome and the Community heart.
// The union of what the four products drew; each is a named export built by a pure call, so an app bundles only
// the glyphs it uses. A product maps its own modes onto the marks in its EDITOR_MODE_ICONS.
export {
  TrashIcon,
  DuplicateIcon,
  SplitPagesIcon,
  CopyIcon,
  PencilIcon,
  RefreshIcon,
  PlusIcon,
  CloseIcon,
  CheckIcon,
  FormatPainterIcon,
  IndentIcon,
  OutdentIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  SideBySideIcon,
  FitViewIcon,
  LockIcon,
} from './actions';
export {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MenuIcon,
  SearchIcon,
  EllipsisIcon,
  MaximizeIcon,
  MinimizeIcon,
} from './navigation';
export {
  SharedDotIcon,
  PrivateDotIcon,
  TabsLabelIcon,
  SparkleIcon,
  CircleXIcon,
  TeamIcon,
} from './status';
export {
  LinkIcon,
  NoteIcon,
  ActionIcon,
  CommentIcon,
  MindOutlineIcon,
  TidyMapIcon,
} from './badges';
export {
  MarkerIcon,
  FlowchartIcon,
  FlipchartIcon,
  PagesIcon,
  PlanIcon,
  PlanCardsIcon,
} from './drawing-kinds';
export {
  UndoIcon,
  RedoIcon,
  ThemeLookIcon,
  LayersStackIcon,
  TidyUpIcon,
  SettingsIcon,
} from './editor-chrome';
export { HeartIcon } from './community';
