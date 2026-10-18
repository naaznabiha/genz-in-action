import type { TextStyle } from "react-native";

/**
 * GenZ in Action design tokens.
 * Source of truth: design-reference/src/index.css (@theme), design-reference/src/data.ts
 * and the prototype screens. The app is dark-only (docs/decisions.md, D4).
 */
export const Colors = {
  bg: "#0B2239",
  card: "#11324D",
  elevated: "#0D2A40",
  deep: "#071828",
  cyan: "#00FFFF",
  cyanDim: "#00BFBF",
  cyanDark: "#009999",
  cyanDeep: "#008888",
  gold: "#FFD700",
  red: "#FF5555",
  redSurface: "#2D0F15",
  green: "#32CD32",
  text1: "#FFFFFF",
  text2: "#CDE2F0",
  text3: "#4A7A9B",
  /** Cyan-tinted hairline used on auth screens and cards. */
  border: "rgba(0,200,200,0.15)",
  /** Neutral hairline used on post cards and list rows. */
  hairline: "rgba(255,255,255,0.07)",
  divider: "rgba(255,255,255,0.05)",
  cyanTint: "rgba(0,255,255,0.1)",
  /** Bottom navigation bar (prototype BottomNav.tsx). */
  navBar: "rgba(8,8,15,0.97)",
  navBorder: "rgba(0,200,200,0.1)",
  overlay: "rgba(0,0,0,0.7)",
} as const;

export type CategoryId =
  | "climate"
  | "equality"
  | "mental-health"
  | "education"
  | "housing"
  | "community"
  | "arts"
  | "tech";

/** Category chip colours, copied from design-reference/src/data.ts (CATEGORY_COLORS). */
export const CategoryColors: Record<CategoryId, { bg: string; text: string; border: string; label: string }> = {
  climate: { bg: "#0D2B1A", text: "#4ADE80", border: "#1A4D2E", label: "Climate" },
  equality: { bg: "#1E1040", text: "#A78BFA", border: "#3B1FA0", label: "Equality" },
  "mental-health": { bg: "#0D1E40", text: "#60A5FA", border: "#1A3A7A", label: "Mental Health" },
  education: { bg: "#2B1E0A", text: "#FBBF24", border: "#6B4F0A", label: "Education" },
  housing: { bg: "#2B0F0A", text: "#FB923C", border: "#5A2010", label: "Housing" },
  community: { bg: "#2B0A1E", text: "#F472B6", border: "#5A1040", label: "Community" },
  arts: { bg: "#1A2B0A", text: "#A3E635", border: "#3A5A10", label: "Arts" },
  tech: { bg: "#0A1E2B", text: "#22D3EE", border: "#103A5A", label: "Tech" },
};

/** 4-pt spacing scale (Tailwind steps used by the prototype). */
export const Spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

/** Corner radii: rounded-lg / -xl / -2xl / -3xl / -full. */
export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

/**
 * Font family names registered in app/_layout.tsx.
 * React Native picks a font *file* by family name; fontWeight alone does not
 * switch weights for custom fonts on Android, so each weight has its own family.
 * The prototype's `font-black` (900) maps to Plus Jakarta Sans 800, its heaviest weight.
 */
export const FontFamily = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semiBold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  displayBold: "PlusJakartaSans_700Bold",
  displayBlack: "PlusJakartaSans_800ExtraBold",
} as const;

/** Type scale derived from the prototype's Tailwind classes. */
export const Typography = {
  /** text-3xl font-black, Plus Jakarta — screen heroes ("Welcome back"). */
  display: { fontFamily: FontFamily.displayBlack, fontSize: 30, lineHeight: 36 },
  /** text-xl/2xl font-black — screen titles. */
  title: { fontFamily: FontFamily.displayBlack, fontSize: 20, lineHeight: 26 },
  /** text-lg font-bold — section and card headings. */
  heading: { fontFamily: FontFamily.displayBold, fontSize: 18, lineHeight: 24 },
  /** text-base font-bold — post titles. */
  subheading: { fontFamily: FontFamily.displayBold, fontSize: 16, lineHeight: 22 },
  /** text-sm — default body copy. */
  body: { fontFamily: FontFamily.regular, fontSize: 14, lineHeight: 21 },
  bodyMedium: { fontFamily: FontFamily.medium, fontSize: 14, lineHeight: 20 },
  bodySemiBold: { fontFamily: FontFamily.semiBold, fontSize: 14, lineHeight: 20 },
  bodyBold: { fontFamily: FontFamily.bold, fontSize: 14, lineHeight: 20 },
  /** text-base font-bold — primary button labels. */
  button: { fontFamily: FontFamily.bold, fontSize: 16, lineHeight: 20 },
  /** text-xs — meta lines, helper and error text. */
  caption: { fontFamily: FontFamily.regular, fontSize: 12, lineHeight: 16 },
  captionSemiBold: { fontFamily: FontFamily.semiBold, fontSize: 12, lineHeight: 16 },
  /** text-[10px]/[11px] — badges, tab labels, uppercase eyebrows. */
  micro: { fontFamily: FontFamily.semiBold, fontSize: 10, lineHeight: 14 },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof Typography;

/** Minimum touch target (Android/iOS accessibility guidance). */
export const MIN_TOUCH = 44;
