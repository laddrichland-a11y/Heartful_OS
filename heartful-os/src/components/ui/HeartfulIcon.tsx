"use client";

import {
  forwardRef,
  type CSSProperties,
  type HTMLAttributes,
  type SVGProps,
} from "react";
import styles from "./HeartfulIcon.module.css";

/**
 * The product icon gateway, backed by the Iconstica Broken and Filled sets.
 * Interactive parents switch the glyph to Filled on hover/focus/active state.
 */
export type HeartfulIcon = React.ForwardRefExoticComponent<
  SVGProps<SVGSVGElement> & { size?: string | number }
>;

type IconStyle = CSSProperties & {
  "--heartful-icon-broken": string;
  "--heartful-icon-filled": string;
};

function glyph(name: string): HeartfulIcon {
  return forwardRef<SVGSVGElement, SVGProps<SVGSVGElement> & { size?: string | number }>(
    function HeartfulGlyph(
      {
        className,
        size,
        width,
        height,
        color,
        style,
        strokeWidth,
        ...props
      },
      ref,
    ) {
      // Iconstica supplies the stroke weight as part of each Broken asset.
      void strokeWidth;

      const iconStyle: IconStyle = {
        ...style,
        ...(size !== undefined ? { width: size, height: size } : {}),
        ...(width !== undefined ? { width } : {}),
        ...(height !== undefined ? { height } : {}),
        ...(color !== undefined ? { color } : {}),
        "--heartful-icon-broken": `url("/icons/iconstica/broken/${name}.svg")`,
        "--heartful-icon-filled": `url("/icons/iconstica/filled/${name}.svg")`,
      };

      return (
        <span
          ref={ref as never}
          className={`heartful-icon ${styles.icon}${className ? ` ${className}` : ""}`}
          style={iconStyle}
          {...(props as HTMLAttributes<HTMLSpanElement>)}
        >
          <span className={`${styles.layer} ${styles.broken}`} aria-hidden="true" />
          <span className={`${styles.layer} ${styles.filled}`} aria-hidden="true" />
        </span>
      );
    },
  );
}

export const LayoutDashboard = glyph("home");
export const Users = glyph("multi-user");
export const UserPlus = glyph("user-plus");
export const CalendarDays = glyph("calendar-days");
export const BarChart3 = glyph("bar-chart-analysis");
export const Settings = glyph("gear");
export const HeartHandshake = glyph("heart");
export const Activity = glyph("heartbeat");
export const ArrowRight = glyph("arrow-right");
export const ArrowLeft = glyph("arrow-left");
export const ChevronRight = glyph("angle-right");
export const ChevronLeft = glyph("angle-left");
export const ChevronDown = glyph("angle-down");
export const ChevronUp = glyph("angle-up");
export const Search = glyph("search");
export const Bell = glyph("bell");
export const MessageCircle = glyph("message");
export const MessageSquare = glyph("message-dots");
export const MessageSquareText = glyph("message-dots");
export const Send = glyph("send");
export const Mail = glyph("envelope");
export const Phone = glyph("phone");
export const User = glyph("user");
export const UserRound = glyph("user");
export const Tag = glyph("tag");
export const Plus = glyph("plus");
export const X = glyph("cancel");
export const Check = glyph("check");
export const CheckCircle2 = glyph("check-circle");
export const Circle = glyph("circle");
export const CircleDot = glyph("circle");
export const XCircle = glyph("cancel-circle");
export const AlertCircle = glyph("exclamation-circle");
export const CircleAlert = glyph("exclamation-circle");
export const AlertTriangle = glyph("exclamation-triangle");
export const Loader2 = glyph("arrow-rotate");
export const Pencil = glyph("pencil");
export const Trash2 = glyph("trash");
export const Save = glyph("check-square");
export const Copy = glyph("copy");
export const Upload = glyph("upload");
export const Download = glyph("download");
export const ExternalLink = glyph("link-external");
export const MoreHorizontal = glyph("3-dots-horizontal");
export const RefreshCw = glyph("arrow-rotate");
export const RotateCcw = glyph("arrow-rotate");
export const History = glyph("clock");
export const Clock = glyph("clock");
export const Clock3 = glyph("clock");
export const Calendar = glyph("calendar");
export const CalendarClock = glyph("calendar-clock");
export const CalendarPlus = glyph("calendar-plus");
export const MapPin = glyph("location-pin");
export const FileText = glyph("file-lines");
export const FileAudio = glyph("file");
export const FileSignature = glyph("file-lines");
export const FileWarning = glyph("file-lines");
export const ClipboardList = glyph("clipboard");
export const ClipboardCheck = glyph("check-square");
export const ListChecks = glyph("numeric-list");
export const IntegrationLink = glyph("link-external");
export const OutstandingTasks = glyph("check-square");
export const ListTodo = glyph("numeric-list");
export const ListFilter = glyph("filter");
export const SlidersHorizontal = glyph("sliders-horizontal");
export const Sparkles = glyph("sparkle");
export const Brain = glyph("brain");
export const StickyNote = glyph("file-lines");
export const BookOpen = glyph("book-open");
export const ScrollText = glyph("file-lines");
export const Music = glyph("music");
export const Radio = glyph("music");
export const Award = glyph("award");
export const Pill = glyph("capsule");
export const DollarSign = glyph("currency-dollar");
export const CircleDollarSign = glyph("circle-dollar");
export const TrendingUp = glyph("arrow-trend-up");
export const Eye = glyph("eye");
export const EyeOff = glyph("eye-slash");
export const KeyRound = glyph("key");
export const ShieldCheck = glyph("shield-check");
export const ShieldOff = glyph("shield-lock");
export const ShieldAlert = glyph("shield-lock");
export const PauseCircle = glyph("pause-circle");
export const PlayCircle = glyph("play-circle");
export const StopCircle = glyph("stop-circle");
export const LogOut = glyph("box-arrow-right");
export const Menu = glyph("grid");
export const PanelLeftClose = glyph("layout-2");
export const PanelLeftOpen = glyph("layout-3");
export const Wallet = glyph("wallet");
export const Sprout = glyph("seedling");
