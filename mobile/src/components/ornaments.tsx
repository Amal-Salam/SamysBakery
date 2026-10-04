import type { ReactNode } from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import Svg, { Circle, Defs, G, Path, Pattern, Rect } from "react-native-svg";

import { colors, fonts } from "@/theme";

// The website's hand-drawn ornaments (owner-approved design pass), drawn with
// the same paths. Purely decorative: hidden from screen readers.

const INK = { fill: "none", stroke: colors.primary, strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const ACCENT = { ...INK, stroke: colors.accent };

function Drawing({ size, width, height, viewBox = "0 0 48 48", children }: { size?: number; width?: number; height?: number; viewBox?: string; children: ReactNode }) {
  return (
    <Svg
      width={width ?? size ?? 32}
      height={height ?? size ?? 32}
      viewBox={viewBox}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {children}
    </Svg>
  );
}

export function WheatDrawing({ size = 32 }: { size?: number }) {
  return (
    <Drawing size={size}>
      <Path {...INK} d="M24 46c-.8-11-.6-24 1-37" />
      <Path {...INK} d="M24.4 34c-4.2-.4-6.6-3.6-6.4-7.4 3.6.6 6 3.6 6.4 7.4zM24.6 34c4-1 5.9-4.4 5.4-8.1-3.5.9-5.5 4.2-5.4 8.1zM24.5 26c-4.1-.5-6.4-3.7-6.1-7.5 3.6.7 5.9 3.7 6.1 7.5zM24.8 26c4-1 5.8-4.4 5.3-8.1-3.4.9-5.4 4.2-5.3 8.1zM24.8 18.2c-3.8-.6-5.9-3.6-5.6-7.1 3.3.7 5.4 3.6 5.6 7.1zM25.1 18.2c3.6-1 5.3-4.1 4.8-7.5-3.1.9-4.9 3.9-4.8 7.5z" />
      <Path {...ACCENT} d="M25 9.5c-.4-2.8-1.4-5.4-3-7.6M25.4 9.5c.9-2.6 2.4-4.9 4.3-6.8" />
    </Drawing>
  );
}

export function RollingPinDrawing({ size = 32 }: { size?: number }) {
  return (
    <Drawing size={size}>
      <Path {...INK} d="M12.5 17.6c7.8-.6 15.6-.6 23.2.1 2.6.3 4.3 2.6 4.1 6.4-.2 3.6-1.8 5.9-4.4 6.1-7.8.6-15.4.6-23 0-2.6-.3-4.2-2.6-4.2-6.3.1-3.7 1.8-6.1 4.3-6.3z" />
      <Path {...INK} d="M8.3 23.8H3.6M39.8 23.8h4.6" />
      <Circle {...INK} cx="2.4" cy="23.8" r="1.6" />
      <Circle {...INK} cx="45.6" cy="23.8" r="1.6" />
      <Path {...ACCENT} d="M16 21.6c3.4.8 6.9.9 10.4.3M22 26.3c3.2.6 6.4.5 9.6-.2" />
    </Drawing>
  );
}

export function LoafDrawing({ size = 32 }: { size?: number }) {
  return (
    <Drawing size={size}>
      <Path {...INK} d="M6.6 34.2C5.6 21.3 13.5 12.4 24 12.3c10.6-.1 18.4 8.6 17.6 21.9" />
      <Path {...INK} d="M4 34.6c13.3.6 26.7.6 40 0" />
      <Path {...ACCENT} d="M14.8 23.6c1.7-1.6 3.6-2.8 5.6-3.6M21.9 20.8c1.8-1.4 3.8-2.4 5.9-3M29.2 22.2c1.6-1.3 3.4-2.2 5.3-2.8" />
      <Path {...INK} d="M9.5 38.5c9.6.4 19.4.4 29 0" />
    </Drawing>
  );
}

export function WhiskDrawing({ size = 32 }: { size?: number }) {
  return (
    <Drawing size={size}>
      <Path {...INK} d="M22 46.5c-.4-5-.2-10.2.5-15.3h3c.8 5.1 1 10.3.5 15.3-1.3.5-2.7.5-4 0z" />
      <Path {...INK} d="M21 31.2h6.2" />
      <Path {...INK} d="M23 31c-9.5-6-10.4-24.4.9-27 11.2 2.2 10.6 20.6 1.2 27" />
      <Path {...INK} d="M23.4 31c-5.5-6.4-5.6-20.8.6-24.6 6.3 3.6 6.4 18 .6 24.6" />
      <Path {...ACCENT} d="M24.1 31c-.4-8.4-.3-17.2-.1-25.8" />
    </Drawing>
  );
}

export function BasketDrawing({ width = 112, height = 92 }: { width?: number; height?: number }) {
  return (
    <Drawing width={width} height={height} viewBox="0 0 120 100">
      <Path {...INK} d="M33 44c-1-17 10-29 27-29s28 12 27 29" />
      <Path {...INK} d="M16.5 44.5c29-1.3 58-1.3 87 0 .4 1.4.4 2.8 0 4.2-29 1.2-58 1.2-87 0-.4-1.4-.4-2.8 0-4.2z" />
      <Path {...INK} d="M20.5 49l7.6 34.6c21.3 1.3 42.6 1.3 63.9 0L99.5 49" />
      <Path {...INK} d="M23.3 61.4c24.5 1 49 1 73.4 0M26 73.4c22.6.9 45.3.9 68 0" />
      <Path {...INK} d="M37 50l2.6 33.4M50 50.4l1 33.6M63 50.5l-.2 33.6M76 50.3l-1.6 33.5M88 49.8l-3 33.6" />
      <Path {...ACCENT} d="M44 44.6c4.4-6 11-9.6 16-9.6s11.6 3.6 16 9.6" />
    </Drawing>
  );
}

export function OvenDrawing({ width = 112, height = 92 }: { width?: number; height?: number }) {
  return (
    <Drawing width={width} height={height} viewBox="0 0 120 100">
      <Path {...INK} d="M20 24.6c26.6-1.2 53.3-1.2 80 0 1.2 20 1.2 40 0 60-26.7 1.2-53.4 1.2-80 0-1.2-20-1.2-40 0-60z" />
      <Path {...INK} d="M20.4 37c26.4.8 52.8.8 79.2 0" />
      <Circle {...INK} cx="31" cy="30.8" r="2.6" />
      <Circle {...INK} cx="41" cy="30.8" r="2.6" />
      <Path {...INK} d="M66 30.8h22" />
      <Path {...INK} d="M31 46c19.4-.7 38.7-.7 58 0 .7 9 .7 18 0 27-19.3.8-38.6.8-58 0-.8-9-.8-18 0-27z" />
      <Path {...INK} d="M38 50.5c14.7.6 29.3.6 44 0" />
      <Path {...INK} d="M47 69c-.5-6.5 5-10.8 13-10.8s13.4 4.3 13 10.8" />
      <Path {...ACCENT} d="M53 63.4l3-2M60 62.4l3-2M66 63.6l2.6-1.8M50 18c-3-3 3-5.4 0-9M60 17c-3-3 3-5.4 0-9M70 18c-3-3 3-5.4 0-9" />
    </Drawing>
  );
}

/** Two hairlines with a small wheat sprig between them. */
export function WheatDivider({ style }: { style?: ViewStyle }) {
  return (
    <View style={[{ flexDirection: "row", alignItems: "center", gap: 12 }, style]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />
      <Svg width={20} height={18} viewBox="0 0 20 18">
        <Path fill="none" stroke={colors.accent} strokeWidth={1} strokeLinecap="round" d="M0 9h20M10 9c-2-2-2-4-1-5M10 9c2-2 2-4 1-5M10 9c-2 2-2 4-1 5M10 9c2 2 2 4 1 5" />
      </Svg>
      <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />
    </View>
  );
}

/** The faint wheat-sprig pattern behind a header band. */
export function PatternBand({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return (
    <View style={[{ borderRadius: 12, overflow: "hidden" }, style]}>
      <Svg style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Defs>
          <Pattern id="wheat" width="72" height="72" patternUnits="userSpaceOnUse">
            <G fill="none" stroke={colors.primary} strokeOpacity={0.14} strokeWidth={0.9} strokeLinecap="round">
              <G transform="translate(14 10) rotate(-18)">
                <Path d="M6 22V2M6 7c-3-1-4-3-4-5 2 0 4 2 4 5zM6 7c3-1 4-3 4-5-2 0-4 2-4 5zM6 12c-3-1-4-3-4-5 2 0 4 2 4 5zM6 12c3-1 4-3 4-5-2 0-4 2-4 5zM6 17c-3-1-4-3-4-5 2 0 4 2 4 5zM6 17c3-1 4-3 4-5-2 0-4 2-4 5z" />
              </G>
              <G transform="translate(50 46) rotate(-18)">
                <Path d="M6 22V2M6 7c-3-1-4-3-4-5 2 0 4 2 4 5zM6 7c3-1 4-3 4-5-2 0-4 2-4 5zM6 12c-3-1-4-3-4-5 2 0 4 2 4 5zM6 12c3-1 4-3 4-5-2 0-4 2-4 5zM6 17c-3-1-4-3-4-5 2 0 4 2 4 5zM6 17c3-1 4-3 4-5-2 0-4 2-4 5z" />
              </G>
            </G>
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#wheat)" />
      </Svg>
      <View style={{ padding: 20 }}>{children}</View>
    </View>
  );
}

type Tone = "filled" | "success" | "warning" | "accent";
const TONES: Record<Tone, { text: string; stroke: string; fill: string; rotate: string }> = {
  filled: { text: colors.primaryForeground, stroke: colors.primary, fill: colors.primary, rotate: "-3deg" },
  success: { text: colors.success, stroke: colors.success, fill: "none", rotate: "1deg" },
  warning: { text: colors.warning, stroke: colors.warning, fill: "none", rotate: "2deg" },
  accent: { text: colors.accent, stroke: colors.accent, fill: "none", rotate: "-2deg" },
};

/** Doodle badge: the text states the meaning; the drawn outline only decorates. */
export function DoodleBadge({ tone, shape = "box", children }: { tone: Tone; shape?: "box" | "oval"; children: string }) {
  const t = TONES[tone];
  return (
    <View style={{ alignSelf: "flex-start", transform: [{ rotate: t.rotate }] }}>
      <Svg style={StyleSheet.absoluteFill} viewBox={shape === "oval" ? "0 0 140 46" : "0 0 100 40"} preserveAspectRatio="none">
        <Path
          d={
            shape === "oval"
              ? "M70 4c38 0 66 7.6 65.6 19.4C135 36 107 42.4 69 42.2 32 42 4.6 35.6 4.4 23.4 4.2 11 32.2 4 70 4z"
              : "M6 8c29-3.6 58-3.3 87 .4 2.6 8 2.8 16 .6 24-29.4 3.6-58.6 3.8-88 .4-2.6-8-2.4-16.4.4-24.8"
          }
          fill={t.fill}
          stroke={t.stroke}
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      </Svg>
      <Text
        style={{
          color: t.text,
          fontFamily: shape === "oval" ? fonts.headingBold : fonts.bodySemibold,
          fontSize: shape === "oval" ? 17 : 12,
          letterSpacing: shape === "oval" ? 0 : 0.5,
          paddingHorizontal: shape === "oval" ? 18 : 12,
          paddingVertical: shape === "oval" ? 6 : 5,
        }}
      >
        {children}
      </Text>
    </View>
  );
}
