import { BlurView } from "expo-blur";
import { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { colors, fonts, radius, softShadow, space, touchTarget, type } from "@/theme";

import { GLASS, useTabBarSpace } from "./glass";
import { PressableScale, Skeleton } from "./motion";

export function Screen({
  children,
  scroll = true,
  onRefresh,
  refreshing = false,
  edges = ["top", "left", "right"],
  compactTitle,
}: {
  children: ReactNode;
  scroll?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  edges?: ("top" | "left" | "right" | "bottom")[];
  /** When set, the large title tucks into a compact frosted bar as the page scrolls. */
  compactTitle?: string;
}) {
  const tabBarSpace = useTabBarSpace();
  const insets = useSafeAreaInsets();
  const [scrollY] = useState(() => new Animated.Value(0));
  const bottom = tabBarSpace ? { paddingBottom: tabBarSpace + space.xl } : null;
  const barOpacity = scrollY.interpolate({ inputRange: [50, 90], outputRange: [0, 1], extrapolate: "clamp" });
  const barShift = scrollY.interpolate({ inputRange: [50, 90], outputRange: [-8, 0], extrapolate: "clamp" });
  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      {scroll ? (
        <Animated.ScrollView
          contentContainerStyle={[styles.content, bottom]}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          onScroll={compactTitle ? Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true }) : undefined}
          refreshControl={
            onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} /> : undefined
          }
        >
          {children}
        </Animated.ScrollView>
      ) : (
        <View style={[styles.content, { flex: 1 }, bottom]}>{children}</View>
      )}
      {compactTitle ? (
        <Animated.View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.compactBar, { paddingTop: insets.top, height: insets.top + 48, opacity: barOpacity, transform: [{ translateY: barShift }] }]}
        >
          <BlurView intensity={50} tint="light" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(248, 243, 234, 0.82)" }]} />
          <Text style={styles.compactTitle}>{compactTitle}</Text>
        </Animated.View>
      ) : null}
    </SafeAreaView>
  );
}

export function Button({
  label,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "outline" | "link";
  loading?: boolean;
  disabled?: boolean;
  accessibilityHint?: string;
}) {
  const inactive = disabled || loading;
  const content = loading ? (
    <ActivityIndicator color={variant === "primary" ? colors.primaryForeground : colors.primary} />
  ) : (
    <Text
      style={[
        styles.buttonText,
        variant === "primary" && { color: colors.primaryForeground },
        variant === "outline" && { color: colors.primary },
        variant === "link" && { color: colors.accent, textDecorationLine: "underline" },
      ]}
    >
      {label}
    </Text>
  );
  return (
    <PressableScale
      scaleTo={variant === "link" ? 1 : 0.97}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={[
        styles.button,
        variant === "primary" && styles.primary,
        variant === "outline" && styles.outline,
        variant === "link" && styles.link,
        inactive && { opacity: 0.6 },
      ]}
    >
      {variant === "primary" ? (
        // A subtle top-to-bottom sheen on the deep brown.
        <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="sheen" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#6A4335" />
              <Stop offset="1" stopColor={colors.primary} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#sheen)" />
        </Svg>
      ) : null}
      {variant === "primary" ? <View style={styles.sheenEdge} /> : null}
      {content}
    </PressableScale>
  );
}

export function Field({ label, error, ...input }: TextInputProps & { label: string; error?: string | null }) {
  return (
    <View style={{ gap: space.xs }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, error ? { borderColor: colors.error } : null]}
        {...input}
      />
      {error ? (
        <Text style={styles.fieldError} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function Notice({ tone, children }: { tone: "error" | "success" | "info"; children: ReactNode }) {
  const color = tone === "error" ? colors.error : tone === "success" ? colors.success : colors.textMuted;
  return (
    <View
      accessibilityRole={tone === "error" ? "alert" : "text"}
      accessibilityLiveRegion="polite"
      style={[styles.notice, { borderColor: color }]}
    >
      <Text style={[type.small, { color }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.xl, gap: space.lg },
  button: {
    minHeight: touchTarget + 4,
    borderRadius: radius.pill,
    paddingHorizontal: space.xl,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  primary: { backgroundColor: colors.primary, ...softShadow, shadowOpacity: 0.2 },
  outline: { borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.surface },
  sheenEdge: { position: "absolute", top: 0, left: 16, right: 16, height: 1, backgroundColor: "rgba(255, 255, 255, 0.22)" },
  compactBar: { position: "absolute", top: 0, left: 0, right: 0, justifyContent: "flex-end", paddingHorizontal: space.xl, paddingBottom: space.sm, borderBottomWidth: 1, borderBottomColor: GLASS.edge, overflow: "hidden" },
  compactTitle: { fontFamily: fonts.heading, fontSize: 20, color: colors.primary },
  link: { minHeight: 40, paddingHorizontal: 0, alignItems: "flex-start" },
  buttonText: { fontFamily: fonts.bodyMedium, fontSize: 16 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text },
  input: {
    minHeight: touchTarget,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    paddingHorizontal: space.md,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
  },
  fieldError: { fontFamily: fonts.body, fontSize: 13, color: colors.error },
  notice: { borderWidth: 1, borderRadius: radius.md, padding: space.md, backgroundColor: colors.surface },
  stepper: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, alignSelf: "flex-start", backgroundColor: colors.surface },
  stepBtn: { width: touchTarget, height: touchTarget, alignItems: "center", justifyContent: "center" },
  choice: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: touchTarget + 8, padding: space.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surface },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: space.lg, gap: space.sm, ...softShadow },
});

/** Loading / error / empty states with an optional drawing (Design System §28). */
export function StateView({
  illustration,
  title,
  description,
  action,
  loading = false,
}: {
  illustration?: ReactNode;
  title?: string;
  description?: string;
  action?: ReactNode;
  loading?: boolean;
}) {
  if (loading) return <SkeletonList variant="lines" count={3} />;
  return (
    <View style={{ paddingVertical: space.xxl, alignItems: "center", gap: space.md }}>
      {illustration}
      {title ? <Text style={[type.h2, { color: colors.text, textAlign: "center" }]}>{title}</Text> : null}
      {description ? <Text style={[type.small, { textAlign: "center", maxWidth: 320 }]}>{description}</Text> : null}
      {action ? <View style={{ marginTop: space.sm, alignSelf: "stretch" }}>{action}</View> : null}
    </View>
  );
}

/** A quantity stepper with accessible labels; bounds enforced again by the server. */
export function Stepper({
  value,
  min = 1,
  max,
  onChange,
  label,
  disabled = false,
}: {
  value: number;
  min?: number;
  max: number;
  onChange: (next: number) => void;
  label: string;
  disabled?: boolean;
}) {
  const btn = (text: string, next: number, a11y: string, off: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled: off }}
      disabled={off}
      onPress={() => onChange(next)}
      style={[styles.stepBtn, off && { opacity: 0.4 }]}
    >
      <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 20, color: colors.primary }}>{text}</Text>
    </Pressable>
  );
  return (
    <View style={styles.stepper}>
      {btn("−", value - 1, `Decrease quantity of ${label}`, disabled || value <= min)}
      <Text accessibilityLabel={`Quantity ${value}`} style={{ minWidth: 32, textAlign: "center", fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.text }}>
        {value}
      </Text>
      {btn("+", value + 1, `Increase quantity of ${label}`, disabled || value >= max)}
    </View>
  );
}

/** A selectable option (radio) — address or delivery date. */
export function Choice({ selected, onPress, title, detail }: { selected: boolean; onPress: () => void; title: string; detail?: string }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={detail ? `${title}, ${detail}` : title}
      onPress={onPress}
      style={[styles.choice, selected && { borderColor: colors.accent, backgroundColor: colors.accentSoft }]}
    >
      <View style={[styles.radio, selected && { borderColor: colors.accent }]}>{selected ? <View style={styles.radioDot} /> : null}</View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text }}>{title}</Text>
        {detail ? <Text style={type.small}>{detail}</Text> : null}
      </View>
    </Pressable>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

/** Content-shaped loading placeholders. */
export function SkeletonList({ variant = "cards", count = 3 }: { variant?: "cards" | "lines"; count?: number }) {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Loading" style={{ gap: variant === "cards" ? space.xl : space.md }}>
      {Array.from({ length: count }, (_, i) =>
        variant === "cards" ? (
          <View key={i} style={{ gap: space.sm }}>
            <Skeleton height={190} round={radius.xl} />
            <Skeleton height={18} width="62%" />
            <Skeleton height={14} width="40%" />
          </View>
        ) : (
          <Skeleton key={i} height={84} round={radius.xl} />
        )
      )}
    </View>
  );
}
