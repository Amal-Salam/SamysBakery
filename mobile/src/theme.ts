// Design tokens mirrored from the website (app/globals.css). Change them here,
// never inline in screens.
export const colors = {
  background: "#F8F3EA",
  surface: "#FFFDF9",
  surfaceMuted: "#F1E9DE",
  text: "#2C211C",
  textMuted: "#756860",
  primary: "#4A2F27",
  primaryForeground: "#FFFDF9",
  accent: "#7B3045",
  accentSoft: "#EAD7DC",
  border: "#DED4C8",
  success: "#3F6B4A",
  warning: "#9A6A25",
  error: "#A33A35",
} as const;

export const fonts = {
  heading: "CormorantGaramond_600SemiBold",
  headingBold: "CormorantGaramond_700Bold",
  body: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  bodySemibold: "Inter_600SemiBold",
} as const;

export const type = {
  display: { fontFamily: fonts.heading, fontSize: 36, lineHeight: 40, color: colors.primary },
  h1: { fontFamily: fonts.heading, fontSize: 30, lineHeight: 34, color: colors.primary },
  h2: { fontFamily: fonts.heading, fontSize: 24, lineHeight: 28, color: colors.primary },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24, color: colors.text },
  small: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.textMuted },
  caption: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: colors.textMuted },
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 6, md: 8, lg: 12 } as const;
/** Android minimum comfortable touch target. */
export const touchTarget = 48;
