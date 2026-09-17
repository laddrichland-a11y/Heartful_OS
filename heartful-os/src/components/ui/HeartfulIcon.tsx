"use client";

import { forwardRef, type ComponentType, type SVGProps } from "react";
import Dashboard2Icon from "mage-icons-react/stroke/Dashboard2Icon";
import UsersIcon from "mage-icons-react/stroke/UsersIcon";
import UserPlusIcon from "mage-icons-react/stroke/UserPlusIcon";
import CalendarIcon from "mage-icons-react/stroke/CalendarIcon";
import CalendarPlusIcon from "mage-icons-react/stroke/CalendarPlusIcon";
import ChartIcon from "mage-icons-react/stroke/ChartIcon";
import ChartUpIcon from "mage-icons-react/stroke/ChartUpIcon";
import SettingsIcon from "mage-icons-react/stroke/SettingsIcon";
import HeartHealthIcon from "mage-icons-react/stroke/HeartHealthIcon";
import ArrowRightIcon from "mage-icons-react/stroke/ArrowRightIcon";
import ArrowLeftIcon from "mage-icons-react/stroke/ArrowLeftIcon";
import ArrowUpIcon from "mage-icons-react/stroke/ArrowUpIcon";
import ArrowDownIcon from "mage-icons-react/stroke/ArrowDownIcon";
import SearchIcon from "mage-icons-react/stroke/SearchIcon";
import NotificationBellIcon from "mage-icons-react/stroke/NotificationBellIcon";
import MessageConversationIcon from "mage-icons-react/stroke/MessageConversationIcon";
import MessageDotsIcon from "mage-icons-react/stroke/MessageDotsIcon";
import EmailIcon from "mage-icons-react/stroke/EmailIcon";
import PhoneCallIcon from "mage-icons-react/stroke/PhoneCallIcon";
import UserIcon from "mage-icons-react/stroke/UserIcon";
import TagIcon from "mage-icons-react/stroke/TagIcon";
import PlusIcon from "mage-icons-react/stroke/PlusIcon";
import CancelIcon from "mage-icons-react/stroke/CancelIcon";
import CheckIcon from "mage-icons-react/stroke/CheckIcon";
import CheckCircleIcon from "mage-icons-react/stroke/CheckCircleIcon";
import DoubleCircleIcon from "mage-icons-react/stroke/DoubleCircleIcon";
import InformationCircleIcon from "mage-icons-react/stroke/InformationCircleIcon";
import TrashIcon from "mage-icons-react/stroke/TrashIcon";
import SaveFloppyIcon from "mage-icons-react/stroke/SaveFloppyIcon";
import CopyIcon from "mage-icons-react/stroke/CopyIcon";
import UploadIcon from "mage-icons-react/stroke/UploadIcon";
import DownloadIcon from "mage-icons-react/stroke/DownloadIcon";
import ExternalLinkIcon from "mage-icons-react/stroke/ExternalLinkIcon";
import DotsHorizontalIcon from "mage-icons-react/stroke/DotsHorizontalIcon";
import RefreshIcon from "mage-icons-react/stroke/RefreshIcon";
import ClockIcon from "mage-icons-react/stroke/ClockIcon";
import LocationPinIcon from "mage-icons-react/stroke/LocationPinIcon";
import FileIcon from "mage-icons-react/stroke/FileIcon";
import ClipboardIcon from "mage-icons-react/stroke/ClipboardIcon";
import ChecklistIcon from "mage-icons-react/stroke/ChecklistIcon";
import LinkIcon from "mage-icons-react/stroke/LinkIcon";
import FilterIcon from "mage-icons-react/stroke/FilterIcon";
import NoteIcon from "mage-icons-react/stroke/NoteIcon";
import BookIcon from "mage-icons-react/stroke/BookIcon";
import MusicIcon from "mage-icons-react/stroke/MusicIcon";
import DollarIcon from "mage-icons-react/stroke/DollarIcon";
import PreviewIcon from "mage-icons-react/stroke/PreviewIcon";
import KeyIcon from "mage-icons-react/stroke/KeyIcon";
import ShieldCheckIcon from "mage-icons-react/stroke/ShieldCheckIcon";
import SecurityShieldIcon from "mage-icons-react/stroke/SecurityShieldIcon";
import PauseIcon from "mage-icons-react/stroke/PauseIcon";
import PlayCircleIcon from "mage-icons-react/stroke/PlayCircleIcon";
import StopCircleIcon from "mage-icons-react/stroke/StopCircleIcon";
import LogoutIcon from "mage-icons-react/stroke/LogoutIcon";
import DashMenuIcon from "mage-icons-react/stroke/DashMenuIcon";
import LayoutLeftIcon from "mage-icons-react/stroke/LayoutLeftIcon";
import LayoutRightIcon from "mage-icons-react/stroke/LayoutRightIcon";
import MoneyExchangeIcon from "mage-icons-react/stroke/MoneyExchangeIcon";
import EditIcon from "mage-icons-react/stroke/EditIcon";

/** The product icon gateway, backed entirely by the Mage Icons stroke set. */
export type HeartfulIcon = React.ForwardRefExoticComponent<SVGProps<SVGSVGElement> & { size?: string | number }>;

type MageIcon = ComponentType<{ className?: string }>;

function glyph(Icon: MageIcon): HeartfulIcon {
  return forwardRef<SVGSVGElement, SVGProps<SVGSVGElement> & { size?: string | number }>(function HeartfulGlyph(
    { className, size, ...props },
    ref,
  ) {
    if (size) {
      return (
        <span ref={ref as never} aria-hidden={props["aria-hidden"]} className="inline-flex shrink-0" style={{ width: size, height: size }}>
          <Icon className={`h-full w-full ${className ?? ""}`} />
        </span>
      );
    }

    return <Icon className={className} />;
  });
}

export const LayoutDashboard = glyph(Dashboard2Icon);
export const Users = glyph(UsersIcon);
export const UserPlus = glyph(UserPlusIcon);
export const CalendarDays = glyph(CalendarIcon);
export const BarChart3 = glyph(ChartIcon);
export const Settings = glyph(SettingsIcon);
export const HeartHandshake = glyph(HeartHealthIcon);
export const Activity = glyph(ChartUpIcon);
export const ArrowRight = glyph(ArrowRightIcon);
export const ArrowLeft = glyph(ArrowLeftIcon);
export const ChevronRight = glyph(ArrowRightIcon);
export const ChevronLeft = glyph(ArrowLeftIcon);
export const ChevronDown = glyph(ArrowDownIcon);
export const ChevronUp = glyph(ArrowUpIcon);
export const Search = glyph(SearchIcon);
export const Bell = glyph(NotificationBellIcon);
export const MessageCircle = glyph(MessageConversationIcon);
export const MessageSquare = glyph(MessageDotsIcon);
export const MessageSquareText = glyph(MessageDotsIcon);
export const Send = glyph(ArrowUpIcon);
export const Mail = glyph(EmailIcon);
export const Phone = glyph(PhoneCallIcon);
export const User = glyph(UserIcon);
export const UserRound = glyph(UserIcon);
export const Tag = glyph(TagIcon);
export const Plus = glyph(PlusIcon);
export const X = glyph(CancelIcon);
export const Check = glyph(CheckIcon);
export const CheckCircle2 = glyph(CheckCircleIcon);
export const Circle = glyph(DoubleCircleIcon);
export const CircleDot = glyph(DoubleCircleIcon);
export const XCircle = glyph(CancelIcon);
export const AlertCircle = glyph(InformationCircleIcon);
export const CircleAlert = glyph(InformationCircleIcon);
export const AlertTriangle = glyph(InformationCircleIcon);
export const Loader2 = glyph(RefreshIcon);
export const Pencil = glyph(EditIcon);
export const Trash2 = glyph(TrashIcon);
export const Save = glyph(SaveFloppyIcon);
export const Copy = glyph(CopyIcon);
export const Upload = glyph(UploadIcon);
export const Download = glyph(DownloadIcon);
export const ExternalLink = glyph(ExternalLinkIcon);
export const MoreHorizontal = glyph(DotsHorizontalIcon);
export const RefreshCw = glyph(RefreshIcon);
export const RotateCcw = glyph(RefreshIcon);
export const History = glyph(ClockIcon);
export const Clock = glyph(ClockIcon);
export const Clock3 = glyph(ClockIcon);
export const Calendar = glyph(CalendarIcon);
export const CalendarClock = glyph(CalendarIcon);
export const CalendarPlus = glyph(CalendarPlusIcon);
export const MapPin = glyph(LocationPinIcon);
export const FileText = glyph(FileIcon);
export const FileAudio = glyph(FileIcon);
export const FileSignature = glyph(FileIcon);
export const FileWarning = glyph(FileIcon);
export const ClipboardList = glyph(ClipboardIcon);
export const ClipboardCheck = glyph(ClipboardIcon);
export const ListChecks = glyph(ChecklistIcon);
export const IntegrationLink = glyph(LinkIcon);
export const OutstandingTasks = glyph(ChecklistIcon);
export const ListTodo = glyph(ChecklistIcon);
export const ListFilter = glyph(FilterIcon);
export const SlidersHorizontal = glyph(FilterIcon);
export const Sparkles = glyph(CheckCircleIcon);
export const Brain = glyph(NoteIcon);
export const StickyNote = glyph(NoteIcon);
export const BookOpen = glyph(BookIcon);
export const ScrollText = glyph(NoteIcon);
export const Music = glyph(MusicIcon);
export const Radio = glyph(MusicIcon);
export const Award = glyph(CheckCircleIcon);
export const Pill = glyph(CheckCircleIcon);
export const DollarSign = glyph(DollarIcon);
export const CircleDollarSign = glyph(DollarIcon);
export const TrendingUp = glyph(ChartUpIcon);
export const Eye = glyph(PreviewIcon);
export const EyeOff = glyph(PreviewIcon);
export const KeyRound = glyph(KeyIcon);
export const ShieldCheck = glyph(ShieldCheckIcon);
export const ShieldOff = glyph(SecurityShieldIcon);
export const ShieldAlert = glyph(SecurityShieldIcon);
export const PauseCircle = glyph(PauseIcon);
export const PlayCircle = glyph(PlayCircleIcon);
export const StopCircle = glyph(StopCircleIcon);
export const LogOut = glyph(LogoutIcon);
export const Menu = glyph(DashMenuIcon);
export const PanelLeftClose = glyph(LayoutLeftIcon);
export const PanelLeftOpen = glyph(LayoutRightIcon);
export const Wallet = glyph(MoneyExchangeIcon);
export const Sprout = glyph(HeartHealthIcon);
