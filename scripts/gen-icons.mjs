// One-off: generate src/components/icons.tsx — a lucide-compatible shim backed
// by HugeIcons. Resolves each lucide name to a REAL exported HugeIcons name
// (verified against the installed package's .d.ts), so the build can't fail on
// a missing import. Run: node scripts/gen-icons.mjs
import fs from 'node:fs'

const dts = fs.readFileSync(
  'node_modules/@hugeicons/core-free-icons/dist/types/index.d.ts',
  'utf8',
)
const EXIST = new Set(dts.match(/[A-Za-z0-9]+Icon\b/g) || [])
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
const baseOf = (h) => norm(h.replace(/Icon$/, '').replace(/\d+$/, ''))
const ALL = [...EXIST]

// Ordered candidates for names where the obvious form is wrong/missing.
const CAND = {
  AlertTriangle: ['Alert01Icon', 'AlertDiamondIcon'],
  ArrowLeft: ['ArrowLeft01Icon'],
  ArrowRight: ['ArrowRight01Icon'],
  ArrowUpRight: ['ArrowUpRight01Icon', 'LinkForwardIcon'],
  Award: ['Award01Icon'],
  BarChart3: ['BarChartIcon', 'AnalyticsUpIcon', 'ChartColumnIcon'],
  Bell: ['Notification03Icon', 'Notification01Icon'],
  Blocks: ['BlocksIcon', 'DashboardSquare02Icon', 'GridViewIcon'],
  BookCheck: ['BookBookmark01Icon', 'Book02Icon', 'BookOpen01Icon'],
  BookOpen: ['BookOpen01Icon'],
  BookOpenCheck: ['BookOpen01Icon', 'BookBookmark01Icon'],
  Bookmark: ['Bookmark01Icon'],
  Bot: ['AiBrain01Icon', 'RoboticIcon', 'BotIcon'],
  Building2: ['Building06Icon', 'Building01Icon', 'BuildingIcon'],
  Calculator: ['Calculator01Icon'],
  CalendarClock: ['CalendarClockIcon', 'Calendar03Icon', 'Calendar01Icon'],
  CalendarDays: ['CalendarDaysIcon', 'Calendar03Icon', 'Calendar01Icon'],
  Check: ['Tick02Icon', 'Tick01Icon', 'CheckmarkBadge01Icon'],
  CheckCheck: ['TickDouble01Icon', 'CheckmarkCircle02Icon'],
  CheckCircle2: ['CheckmarkCircle02Icon', 'CheckmarkCircle01Icon'],
  ChevronDown: ['ArrowDown01Icon'],
  ChevronRight: ['ArrowRight01Icon'],
  ClipboardCheck: ['ClipboardCheckIcon', 'CheckListIcon', 'TaskDone01Icon'],
  Clock: ['Clock01Icon'],
  Copy: ['Copy01Icon'],
  Crown: ['Crown02Icon', 'CrownIcon'],
  Database: ['Database01Icon'],
  Download: ['Download01Icon'],
  ExternalLink: ['LinkSquare02Icon', 'LinkForwardIcon'],
  Eye: ['ViewIcon', 'EyeIcon'],
  EyeOff: ['ViewOffSlashIcon', 'ViewOffIcon'],
  FileEdit: ['Edit02Icon', 'PencilEdit02Icon', 'File01Icon'],
  FileQuestion: ['Quiz01Icon', 'Quiz02Icon', 'File01Icon'],
  FileText: ['File01Icon', 'DocumentTextIcon'],
  Flame: ['FireIcon', 'Fire02Icon'],
  FlaskConical: ['TestTube01Icon', 'TestTubeIcon', 'LabsIcon'],
  Gift: ['GiftIcon', 'Gift01Icon'],
  Globe: ['GlobalIcon', 'Globe02Icon'],
  Globe2: ['GlobalIcon', 'Globe02Icon'],
  GraduationCap: ['Mortarboard01Icon', 'MortarboardIcon', 'GraduationScrollIcon'],
  Grid3x3: ['GridViewIcon', 'Grid3X3Icon', 'GridIcon'],
  HelpCircle: ['HelpCircleIcon', 'QuestionIcon'],
  Home: ['Home01Icon'],
  Inbox: ['InboxIcon'],
  IndianRupee: ['IndianRupeeIcon', 'RupeeIcon', 'BadgeIndianRupeeIcon'],
  Info: ['InformationCircleIcon', 'InformationSquareIcon'],
  KeyRound: ['Key01Icon', 'KeyIcon'],
  Languages: ['TranslateIcon', 'LanguageSkillIcon'],
  Layers: ['Layers01Icon'],
  LayoutDashboard: ['DashboardSquare01Icon', 'DashboardBrowsingIcon', 'Layout01Icon'],
  Library: ['LibrariesIcon', 'Bookshelf01Icon', 'Book02Icon'],
  LifeBuoy: ['LifebuoyIcon', 'HelpCircleIcon'],
  Lightbulb: ['Idea01Icon', 'BulbIcon', 'IdeaIcon'],
  ListChecks: ['CheckListIcon', 'TaskDone01Icon', 'LeftToRightListBulletIcon'],
  Loader2: ['Loading03Icon', 'Loading01Icon', 'ReloadIcon'],
  LogOut: ['Logout01Icon', 'LogoutIcon'],
  Mail: ['Mail01Icon'],
  Medal: ['Medal01Icon'],
  Megaphone: ['Megaphone01Icon', 'MegaphoneIcon'],
  MessageCircle: ['BubbleChatIcon', 'Message01Icon'],
  MessageSquare: ['Message01Icon', 'ChattingIcon'],
  MessageSquarePlus: ['MessageAdd01Icon', 'Message01Icon'],
  Palette: ['PaintBoardIcon', 'ColorPickerIcon', 'Brush01Icon'],
  Pencil: ['PencilEdit01Icon', 'PencilIcon', 'Edit02Icon'],
  Phone: ['Call02Icon', 'TelephoneIcon', 'CallIcon'],
  PieChart: ['PieChartIcon', 'PieChart01Icon'],
  Play: ['PlayIcon', 'Play01Icon'],
  PlayCircle: ['PlayCircleIcon', 'PlayCircle02Icon'],
  Plus: ['Add01Icon', 'PlusSignIcon', 'AddIcon'],
  Puzzle: ['PuzzleIcon', 'Puzzle01Icon'],
  Radio: ['LiveStreaming01Icon', 'RadioIcon', 'Radio01Icon'],
  RotateCcw: ['ArrowReloadHorizontalIcon', 'RefreshIcon', 'ReloadIcon'],
  Save: ['FloppyDiskIcon', 'Download04Icon'],
  Send: ['SentIcon', 'Sent02Icon', 'Navigation03Icon', 'Mail01Icon'],
  Settings: ['Settings01Icon', 'Settings02Icon'],
  Share2: ['Share08Icon', 'Share01Icon'],
  Shield: ['Shield01Icon', 'ShieldIcon'],
  ShieldCheck: ['SecurityCheckIcon', 'Shield01Icon', 'ShieldIcon'],
  Shuffle: ['ShuffleIcon', 'Shuffle01Icon'],
  Sparkles: ['SparklesIcon', 'MagicWand01Icon'],
  Square: ['SquareIcon', 'Square01Icon'],
  Star: ['StarIcon', 'Star01Icon'],
  Swords: ['Sword01Icon', 'SwordIcon'],
  Target: ['Target01Icon', 'TargetIcon'],
  Trash2: ['Delete02Icon', 'Delete01Icon', 'DeleteIcon'],
  TrendingUp: ['AnalyticsUpIcon', 'ChartUpIcon', 'TradeUpIcon', 'ArrowUpRight01Icon'],
  Trophy: ['ChampionIcon', 'TrophyIcon'],
  Upload: ['Upload01Icon', 'UploadIcon'],
  UploadCloud: ['CloudUploadIcon', 'Upload04Icon'],
  UserPlus: ['UserAdd01Icon', 'AddTeamIcon', 'UserAddIcon'],
  UserRound: ['UserCircleIcon', 'UserIcon', 'User02Icon'],
  Users: ['UserGroupIcon', 'UserMultiple02Icon', 'UserMultipleIcon'],
  Wand2: ['MagicWand01Icon', 'MagicWandIcon'],
  X: ['Cancel01Icon', 'MultiplicationSignIcon', 'CancelIcon'],
  XCircle: ['CancelCircleIcon', 'CancelCircleHalfDotIcon'],
  Zap: ['FlashIcon', 'EnergyIcon'],
  Percent: ['PercentIcon', 'DiscountIcon'],
  Lock: ['LockIcon', 'SquareLock01Icon'],
  Circle: ['CircleIcon'],
  Star01: ['StarIcon'],
}

const LUCIDE =
  'AlertCircle AlertTriangle ArrowLeft ArrowRight ArrowUpRight Award BarChart3 Bell Blocks BookCheck BookOpen BookOpenCheck Bookmark Bot Building2 Calculator CalendarClock CalendarDays Check CheckCheck CheckCircle2 ChevronDown ChevronRight Circle ClipboardCheck Clock Copy CreditCard Crown Database Download ExternalLink Eye EyeOff FileEdit FileQuestion FileText Flame FlaskConical Gift Globe Globe2 GraduationCap Grid3x3 HelpCircle Home Inbox IndianRupee Info KeyRound Languages Layers LayoutDashboard Library LifeBuoy Lightbulb ListChecks Loader2 Lock LogOut Mail Medal Megaphone MessageCircle MessageSquare MessageSquarePlus Palette Pencil Percent Phone PieChart Play PlayCircle Plus Puzzle Radio RotateCcw Save Send Settings Share2 Shield ShieldCheck Shuffle Sparkles Square Star Swords Target Trash2 TrendingUp Trophy Upload UploadCloud UserPlus UserRound Users Wand2 X XCircle Zap'.split(
    ' ',
  )

function resolve(l) {
  const tries = [
    ...(CAND[l] || []),
    `${l}Icon`,
    `${l.replace(/\d+$/, '')}Icon`,
    `${l.replace(/\d+$/, '')}01Icon`,
    `${l.replace(/\d+$/, '')}02Icon`,
  ]
  for (const t of tries) if (EXIST.has(t)) return t
  // last resort: exact normalized base match
  const ln = baseOf(`${l}Icon`)
  const m = ALL.find((h) => baseOf(h) === ln)
  return m || null
}

const map = {}
const unresolved = []
for (const l of LUCIDE) {
  const r = resolve(l)
  if (r) map[l] = r
  else unresolved.push(l)
}

if (unresolved.length) {
  console.error('UNRESOLVED:', unresolved.join(', '))
  process.exit(1)
}

const used = [...new Set(Object.values(map))].sort()
const lines = []
lines.push(
  '/**',
  ' * Icon shim — lucide-compatible components backed by HugeIcons.',
  ' *',
  ' * The whole app imports icons from here (was lucide-react). Each export is a',
  " * lucide-named component that renders the HugeIcons equivalent, accepting the",
  ' * same `className` (Tailwind h-/w- sizing + text-color) usage. GENERATED by',
  ' * scripts/gen-icons.mjs — edit the map there, not this file.',
  ' */',
  '',
  "import type { ReactElement, SVGProps } from 'react'",
  '',
  "import { HugeiconsIcon } from '@hugeicons/react'",
  'import {',
  ...used.map((u) => `  ${u},`),
  "} from '@hugeicons/core-free-icons'",
  '',
  '// Mirrors lucide-react: every SVG attribute (className, style, onClick,',
  '// aria-*, ...) is accepted and forwarded. `strokeWidth` is narrowed to',
  '// `number` (HugeIcons wants a number) and `size` is added (lucide extra).',
  'export interface IconProps',
  "  extends Omit<SVGProps<SVGSVGElement>, 'ref' | 'strokeWidth'> {",
  '  size?: number | string',
  '  strokeWidth?: number',
  '}',
  '',
  '/** Drop-in type for `icon: LucideIcon` props elsewhere in the app. */',
  'export type LucideIcon = (props: IconProps) => ReactElement',
  '',
  "type HugeIcon = Parameters<typeof HugeiconsIcon>[0]['icon']",
  '',
  'function make(icon: HugeIcon): LucideIcon {',
  '  return function Icon({ strokeWidth = 1.8, color, ...rest }: IconProps) {',
  '    return (',
  '      <HugeiconsIcon',
  '        icon={icon}',
  '        strokeWidth={strokeWidth}',
  "        color={color ?? 'currentColor'}",
  '        {...rest}',
  '      />',
  '    )',
  '  }',
  '}',
  '',
)
for (const l of LUCIDE) lines.push(`export const ${l} = make(${map[l]})`)
lines.push('')

fs.writeFileSync('src/components/icons.tsx', lines.join('\n'))
console.log('Wrote src/components/icons.tsx with', LUCIDE.length, 'icons (', used.length, 'distinct HugeIcons ).')
console.log('Sample:', LUCIDE.slice(0, 8).map((l) => `${l}=${map[l]}`).join('  '))
