import { BlurTargetView, BlurView } from "expo-blur";
import { createContext, useContext, useRef, type ReactNode } from "react";
import { Platform, StyleSheet, View } from "react-native";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";

import { colors, radius, space } from "@/theme";

// "Soft glass" (owner-approved, mobile app only): warm glows behind a frosted
// header card, and a frosted-translucent tab bar. Text-heavy content (prices,
// details, checkout) always stays on solid backgrounds.

/** Height of the floating tab bar, so tab screens can keep content clear of it. */
export const TabBarSpace = createContext(0);
export function useTabBarSpace() {
  return useContext(TabBarSpace);
}

export const GLASS = {
  tint: "rgba(255, 253, 249, 0.55)",
  edge: "rgba(255, 255, 255, 0.75)",
  bar: "rgba(255, 253, 249, 0.86)",
} as const;

/** Soft caramel, cream and berry glows. Radial gradients stay soft even without blur. */
function WarmGlow() {
  return (
    <Svg width="100%" height="100%" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        <RadialGradient id="caramel" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#E7C9A3" stopOpacity="0.95" />
          <Stop offset="1" stopColor="#E7C9A3" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="cream" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#F1D9C4" stopOpacity="0.95" />
          <Stop offset="1" stopColor="#F1D9C4" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="berry" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={colors.accentSoft} stopOpacity="1" />
          <Stop offset="1" stopColor={colors.accentSoft} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Ellipse cx="12%" cy="12%" rx="48%" ry="42%" fill="url(#caramel)" />
      <Ellipse cx="92%" cy="22%" rx="40%" ry="38%" fill="url(#cream)" />
      <Ellipse cx="48%" cy="78%" rx="38%" ry="32%" fill="url(#berry)" />
    </Svg>
  );
}

/**
 * Frosted header card over warm glows. On Android 12+ the glows are truly
 * blurred (BlurTargetView); older phones get the same look, translucent.
 */
export function GlassHeader({ children }: { children: ReactNode }) {
  const target = useRef<View | null>(null);
  return (
    <View style={styles.stage}>
      <BlurTargetView ref={target} style={StyleSheet.absoluteFill}>
        <WarmGlow />
      </BlurTargetView>
      <BlurView blurTarget={target} blurMethod="dimezisBlurViewSdk31Plus" intensity={40} tint="light" style={styles.card}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: GLASS.tint }]} />
        <View style={{ padding: space.xl - 4, gap: space.xs }}>{children}</View>
      </BlurView>
    </View>
  );
}

/** Tab bar background: real blur on iOS; frosted translucent on Android. */
export function TabBarGlass() {
  if (Platform.OS === "ios") return <BlurView intensity={50} tint="light" style={StyleSheet.absoluteFill} />;
  return null;
}

const styles = StyleSheet.create({
  // Extends the glow to the screen edges behind the card (Screen pads by space.xl).
  stage: {
    marginHorizontal: -space.xl,
    marginTop: -space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.xl,
  },
  card: {
    borderRadius: radius.lg + 4,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: GLASS.edge,
    shadowColor: colors.primary,
    shadowOpacity: 0.08,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
  },
});
