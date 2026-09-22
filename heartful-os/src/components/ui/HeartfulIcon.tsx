"use client";

import {
  forwardRef,
  type CSSProperties,
  type HTMLAttributes,
  type SVGProps,
} from "react";
import * as Lucide from "lucide-react";
import styles from "./HeartfulIcon.module.css";

/**
 * The product icon gateway uses the Iconstica family throughout: Line at
 * rest, then Filled for interactive hover, focus, and selected states.
 */
export type HeartfulIcon = React.ForwardRefExoticComponent<
  SVGProps<SVGSVGElement> & { size?: string | number }
>;

type IconStyle = CSSProperties & {
  "--heartful-icon-line": string;
  "--heartful-icon-filled": string;
};

type StrokeIcon = React.ComponentType<SVGProps<SVGSVGElement>>;

function glyph(name: string, StrokeIcon: StrokeIcon): HeartfulIcon {
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
      // Iconstica supplies the visual weight as part of each SVG asset.
      void strokeWidth;

      const iconStyle: IconStyle = {
        ...style,
        ...(size !== undefined ? { width: size, height: size } : {}),
        ...(width !== undefined ? { width } : {}),
        ...(height !== undefined ? { height } : {}),
        ...(color !== undefined ? { color } : {}),
        "--heartful-icon-line": `url("/icons/iconstica/line/${name}.svg")`,
        "--heartful-icon-filled": `url("/icons/iconstica/filled/${name}.svg")`,
      };

      return (
        <span
          ref={ref as never}
          className={`heartful-icon ${styles.icon}${className ? ` ${className}` : ""}`}
          style={iconStyle}
          {...(props as HTMLAttributes<HTMLSpanElement>)}
        >
          <StrokeIcon className={styles.regular} strokeWidth={strokeWidth ?? 1.8} aria-hidden="true" />
          <span className={`${styles.layer} ${styles.line}`} aria-hidden="true" />
          <span className={`${styles.layer} ${styles.filled}`} aria-hidden="true" />
        </span>
      );
    },
  );
}

export const LayoutDashboard = glyph("home", Lucide.House);
export const Users = glyph("multi-user", Lucide.Users);
export const UserPlus = glyph("user-plus", Lucide.UserPlus);
export const CalendarDays = glyph("calendar-days", Lucide.CalendarDays);
export const BarChart3 = glyph("bar-chart-analysis", Lucide.BarChart3);
export const Settings = glyph("gear", Lucide.Settings);
export const HeartHandshake = glyph("heart", Lucide.HeartHandshake);
export const Activity = glyph("heartbeat", Lucide.Activity);
export const ArrowRight = glyph("arrow-right", Lucide.ArrowRight);
export const ArrowLeft = glyph("arrow-left", Lucide.ArrowLeft);
export const ChevronRight = glyph("angle-right", Lucide.ChevronRight);
export const ChevronLeft = glyph("angle-left", Lucide.ChevronLeft);
export const ChevronDown = glyph("angle-down", Lucide.ChevronDown);
export const ChevronUp = glyph("angle-up", Lucide.ChevronUp);
export const Search = glyph("search", Lucide.Search);
export const Bell = glyph("bell", Lucide.Bell);
export const MessageCircle = glyph("message", Lucide.MessageCircle);
export const MessageSquare = glyph("message-dots", Lucide.MessageSquare);
export const MessageSquareText = glyph("message-dots", Lucide.MessageSquareText);
export const Send = glyph("send", Lucide.Send);
export const Mail = glyph("envelope", Lucide.Mail);
export const Phone = glyph("phone", Lucide.Phone);
export const User = glyph("user", Lucide.User);
export const UserRound = glyph("user", Lucide.UserRound);
export const Tag = glyph("tag", Lucide.Tag);
export const Plus = glyph("plus", Lucide.Plus);
export const X = glyph("cancel", Lucide.X);
export const Check = glyph("check", Lucide.Check);
export const CheckCircle2 = glyph("check-circle", Lucide.CheckCircle2);
export const Circle = glyph("circle", Lucide.Circle);
export const CircleDot = glyph("circle", Lucide.CircleDot);
export const XCircle = glyph("cancel-circle", Lucide.XCircle);
export const AlertCircle = glyph("exclamation-circle", Lucide.AlertCircle);
export const CircleAlert = glyph("exclamation-circle", Lucide.CircleAlert);
export const AlertTriangle = glyph("exclamation-triangle", Lucide.AlertTriangle);
export const Loader2 = glyph("arrow-rotate", Lucide.Loader2);
export const Pencil = glyph("pencil", Lucide.Pencil);
export const Trash2 = glyph("trash", Lucide.Trash2);
export const Save = glyph("check-square", Lucide.Save);
export const Copy = glyph("copy", Lucide.Copy);
export const Upload = glyph("upload", Lucide.Upload);
export const Download = glyph("download", Lucide.Download);
export const ExternalLink = glyph("link-external", Lucide.ExternalLink);
export const MoreHorizontal = glyph("3-dots-horizontal", Lucide.MoreHorizontal);
export const RefreshCw = glyph("arrow-rotate", Lucide.RefreshCw);
export const RotateCcw = glyph("arrow-rotate", Lucide.RotateCcw);
export const History = glyph("clock", Lucide.History);
export const Clock = glyph("clock", Lucide.Clock);
export const Clock3 = glyph("clock", Lucide.Clock3);
export const Calendar = glyph("calendar", Lucide.Calendar);
export const CalendarClock = glyph("calendar-clock", Lucide.CalendarClock);
export const CalendarPlus = glyph("calendar-plus", Lucide.CalendarPlus);
export const MapPin = glyph("location-pin", Lucide.MapPin);
export const FileText = glyph("file-lines", Lucide.FileText);
export const FileAudio = glyph("file", Lucide.FileAudio);
export const FileSignature = glyph("file-lines", Lucide.FileSignature);
export const FileWarning = glyph("file-lines", Lucide.FileWarning);
export const ClipboardList = glyph("clipboard", Lucide.ClipboardList);
export const ClipboardCheck = glyph("check-square", Lucide.ClipboardCheck);
export const ListChecks = glyph("numeric-list", Lucide.ListChecks);
export const IntegrationLink = glyph("link-external", Lucide.ExternalLink);
export const OutstandingTasks = glyph("check-square", Lucide.ListTodo);
export const ListTodo = glyph("numeric-list", Lucide.ListTodo);
export const ListFilter = glyph("filter", Lucide.ListFilter);
export const SlidersHorizontal = glyph("sliders-horizontal", Lucide.SlidersHorizontal);
export const Sparkles = glyph("sparkle", Lucide.Sparkles);
export const Brain = glyph("brain", Lucide.Brain);
export const StickyNote = glyph("file-lines", Lucide.StickyNote);
export const BookOpen = glyph("book-open", Lucide.BookOpen);
export const ScrollText = glyph("file-lines", Lucide.ScrollText);
export const Music = glyph("music", Lucide.Music);
export const Radio = glyph("music", Lucide.Radio);
export const Award = glyph("award", Lucide.Award);
export const Pill = glyph("capsule", Lucide.Pill);
export const DollarSign = glyph("currency-dollar", Lucide.DollarSign);
export const CircleDollarSign = glyph("circle-dollar", Lucide.CircleDollarSign);
export const TrendingUp = glyph("arrow-trend-up", Lucide.TrendingUp);
export const Eye = glyph("eye", Lucide.Eye);
export const EyeOff = glyph("eye-slash", Lucide.EyeOff);
export const KeyRound = glyph("key", Lucide.KeyRound);
export const ShieldCheck = glyph("shield-check", Lucide.ShieldCheck);
export const ShieldOff = glyph("shield-lock", Lucide.ShieldOff);
export const ShieldAlert = glyph("shield-lock", Lucide.ShieldAlert);
export const PauseCircle = glyph("pause-circle", Lucide.PauseCircle);
export const PlayCircle = glyph("play-circle", Lucide.PlayCircle);
export const StopCircle = glyph("stop-circle", Lucide.StopCircle);
export const LogOut = glyph("box-arrow-right", Lucide.LogOut);
export const Menu = glyph("grid", Lucide.Menu);
export const PanelLeftClose = glyph("layout-2", Lucide.PanelLeftClose);
export const PanelLeftOpen = glyph("layout-3", Lucide.PanelLeftOpen);
export const Wallet = glyph("wallet", Lucide.Wallet);
export const Sprout = glyph("seedling", Lucide.Sprout);
