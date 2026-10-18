/**
 * Icon set ported 1:1 from design-reference/src/components/Icons.tsx to react-native-svg.
 * Path data is unchanged so icons match the prototype exactly.
 *
 * Usage: <HeartIcon size={18} color={Colors.text2} />
 * Icons are decorative: put the accessibilityLabel on the Pressable that wraps them.
 */
import Svg, { Circle, Path } from "react-native-svg";

export type IconProps = { size?: number; color?: string };

/** Stroked (outline) icon from a single path, matching the prototype's `i(d)` helper. */
function outline(d: string, strokeWidth = 1.75) {
  function OutlineIcon({ size = 24, color = "#FFFFFF" }: IconProps) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d={d} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </Svg>
    );
  }
  return OutlineIcon;
}

/** Filled icon from a single path. */
function filled(d: string, viewBox = "0 0 24 24", extra?: { fillRule?: "evenodd" | "nonzero" }) {
  function FilledIcon({ size = 24, color = "#FFFFFF" }: IconProps) {
    return (
      <Svg width={size} height={size} viewBox={viewBox} fill={color}>
        <Path d={d} fill={color} fillRule={extra?.fillRule} clipRule={extra?.fillRule} />
      </Svg>
    );
  }
  return FilledIcon;
}

export const HomeIcon = outline(
  "M3 12L5 10M5 10L12 3L19 10M5 10V20C5 20.5523 5.44772 21 6 21H9M19 10L21 12M19 10V20C19 20.5523 18.5523 21 18 21H15M9 21V15C9 14.4477 9.44772 14 10 14H14C14.5523 14 15 14.4477 15 15V21M9 21H15",
);
// The prototype drew this 20-unit path inside a 24-unit viewBox, which shrank it and pushed it
// off-centre. Using its native 20-unit viewBox keeps it the same size as the other tab icons.
export const HomeFilledIcon = filled(
  "M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z",
  "0 0 20 20",
);

export const CompassIcon = outline(
  "M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22ZM16.24 7.76L14.12 14.12L7.76 16.24L9.88 9.88L16.24 7.76Z",
);
export const CompassFilledIcon = filled(
  "M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm3.93 6.07l-5.95 2.5a1 1 0 00-.52.52l-2.5 5.95a.5.5 0 00.65.65l5.95-2.5a1 1 0 00.52-.52l2.5-5.95a.5.5 0 00-.65-.65zM12 11a1 1 0 100 2 1 1 0 000-2z",
  "0 0 24 24",
  { fillRule: "evenodd" },
);

export const PlusIcon = outline("M12 5V19M5 12H19", 2);

export const BookmarkIcon = outline(
  "M19 21L12 16L5 21V5C5 3.89543 5.89543 3 7 3H17C18.1046 3 19 3.89543 19 5V21Z",
);
export const BookmarkFilledIcon = filled("M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z");

export const PersonIcon = outline(
  "M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21M16 7C16 9.20914 14.2091 11 12 11C9.79086 11 8 9.20914 8 7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7Z",
);
export const PersonFilledIcon = filled(
  "M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z",
);

const HEART =
  "M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z";
export const HeartIcon = outline(HEART);
export const HeartFilledIcon = filled(HEART);

export const ChatBubbleIcon = outline(
  "M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z",
);
export const ShareIcon = outline("M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13");
export const SearchIcon = outline(
  "M21 21L16.65 16.65M19 11C19 15.4183 15.4183 19 11 19C6.58172 19 3 15.4183 3 11C3 6.58172 6.58172 3 11 3C15.4183 3 19 6.58172 19 11Z",
);
export const BellIcon = outline("M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0");
export const BellFilledIcon = filled(
  "M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z",
);

export function SettingsIcon({ size = 24, color = "#FFFFFF" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M19.4 15C19.1277 15.6171 19.2583 16.3378 19.73 16.82L19.79 16.88C20.1656 17.2551 20.3766 17.7642 20.3766 18.295C20.3766 18.8258 20.1656 19.3349 19.79 19.71C19.4149 20.0856 18.9058 20.2966 18.375 20.2966C17.8442 20.2966 17.3351 20.0856 16.96 19.71L16.9 19.65C16.4178 19.1783 15.6971 19.0477 15.08 19.32C14.4755 19.5791 14.0826 20.1724 14.08 20.83V21C14.08 22.1046 13.1846 23 12.08 23C10.9754 23 10.08 22.1046 10.08 21V20.91C10.0642 20.2327 9.63587 19.6339 9 19.4C8.38291 19.1277 7.66219 19.2583 7.18 19.73L7.12 19.79C6.74486 20.1656 6.23582 20.3766 5.705 20.3766C5.17418 20.3766 4.66514 20.1656 4.29 19.79C3.91435 19.4149 3.70343 18.9058 3.70343 18.375C3.70343 17.8442 3.91435 17.3351 4.29 16.96L4.35 16.9C4.82167 16.4178 4.95231 15.6971 4.68 15.08C4.42093 14.4755 3.82764 14.0826 3.17 14.08H3C1.89543 14.08 1 13.1846 1 12.08C1 10.9754 1.89543 10.08 3 10.08H3.09C3.76733 10.0642 4.36613 9.63587 4.6 9C4.87231 8.38291 4.74167 7.66219 4.27 7.18L4.21 7.12C3.83435 6.74486 3.62343 6.23582 3.62343 5.705C3.62343 5.17418 3.83435 4.66514 4.21 4.29C4.58514 3.91435 5.09418 3.70343 5.625 3.70343C6.15582 3.70343 6.66486 3.91435 7.04 4.29L7.1 4.35C7.58219 4.82167 8.30291 4.95231 8.92 4.68H9C9.60447 4.42093 9.99738 3.82764 10 3.17V3C10 1.89543 10.8954 1 12 1C13.1046 1 14 1.89543 14 3V3.09C14.0026 3.74764 14.3955 4.34093 15 4.6C15.6171 4.87231 16.3378 4.74167 16.82 4.27L16.88 4.21C17.2551 3.83435 17.7642 3.62343 18.295 3.62343C18.8258 3.62343 19.3349 3.83435 19.71 4.21C20.0856 4.58514 20.2966 5.09418 20.2966 5.625C20.2966 6.15582 20.0856 6.66486 19.71 7.04L19.65 7.1C19.1783 7.58219 19.0477 8.30291 19.32 8.92V9C19.5791 9.60447 20.1724 9.99738 20.83 10H21C22.1046 10 23 10.8954 23 12C23 13.1046 22.1046 14 21 14H20.91C20.2524 14.0026 19.6591 14.3955 19.4 15Z"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Verified badge. Prototype default colour is #A78BFA. */
export function CheckVerifiedIcon({ size = 16, color = "#A78BFA" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Path
        d="M6.5 2.5C7 1.5 9 1.5 9.5 2.5C10.1669 1.70017 12.0998 2.20017 12.5 3.5C13.5 3.8669 14 5.6998 13.2 6.5C13.8 7.5 13 9.3 12 9.5C12 10.5 11 12.2 9.5 12C9 13 7 13 6.5 12C5 12.2 4 10.5 4 9.5C3 9.3 2.2 7.5 2.8 6.5C2 5.6998 2.5 3.8669 3.5 3.5C3.9002 2.20017 5.8331 1.70017 6.5 2.5Z"
        fill={color}
      />
      <Path d="M5.5 8L7 9.5L10.5 6" stroke="#FFFFFF" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export const ArrowLeftIcon = outline("M19 12H5M12 19l-7-7 7-7");
export const MapPinIcon = outline("M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0zM12 13a3 3 0 100-6 3 3 0 000 6z");
export const CalendarIcon = outline("M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zM16 2v4M8 2v4M3 10h18");
export const UsersIcon = outline(
  "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75M9 7a4 4 0 100 8 4 4 0 000-8z",
);
export const FireIcon = filled(
  "M13.5 2C13.5 2 13 6 10.5 8C8 10 5 10 5 10C5 10 7.5 12 7.5 15.5C7.5 17.5 6.5 19 6.5 19C6.5 19 8 18.5 9.5 17.5C11 16.5 12 15 12 15C12 15 13 17 12.5 19.5C14.5 18 16 15.5 16 13C16 11.5 15 10 15 10C15 10 17 9 18.5 7C19.5 5.5 19.5 3.5 19.5 3.5C19.5 3.5 17 4.5 15.5 4C14.5 3.5 13.5 2 13.5 2Z",
);
export const CloseIcon = outline("M18 6L6 18M6 6l12 12");

export function DotsIcon({ size = 24, color = "#FFFFFF" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Circle cx={12} cy={5} r={1.5} fill={color} />
      <Circle cx={12} cy={12} r={1.5} fill={color} />
      <Circle cx={12} cy={19} r={1.5} fill={color} />
    </Svg>
  );
}

export const LightningIcon = filled("M13 2L3 14h9l-1 8 10-12h-9l1-8z");
export const CheckIcon = outline("M20 6L9 17l-5-5");
export const ChevronRightIcon = outline("M9 18l6-6-6-6");
export const EyeIcon = outline("M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 15a3 3 0 100-6 3 3 0 000 6z");
export const EyeOffIcon = outline(
  "M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22",
);
export const ImageIcon = outline(
  "M21 19a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h3l2-3h4l2 3h3a2 2 0 012 2v12zM8.5 13.5a4 4 0 004 4 4 4 0 004-4 4 4 0 00-4-4 4 4 0 00-4 4z",
);
export const LinkIcon = outline(
  "M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71",
);
export const GlobeIcon = outline(
  "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z",
);
export const TrophyIcon = outline(
  "M8 21h8M12 17v4M7 3H4a1 1 0 00-1 1v3c0 2.5 1.5 4.5 4 5M17 3h3a1 1 0 011 1v3c0 2.5-1.5 4.5-4 5M12 17c-3.866 0-7-3.134-7-7V3h14v7c0 3.866-3.134 7-7 7z",
);
export const EditIcon = outline(
  "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
);
export const LogOutIcon = outline("M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9");
export const ShieldIcon = outline("M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z");
