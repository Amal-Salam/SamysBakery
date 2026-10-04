import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, fonts, radius, space, touchTarget, type } from "@/theme";

export function Screen({
  children,
  scroll = true,
  onRefresh,
  refreshing = false,
  edges = ["top", "left", "right"],
}: {
  children: ReactNode;
  scroll?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  edges?: ("top" | "left" | "right" | "bottom")[];
}) {
  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} /> : undefined
          }
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, { flex: 1 }]}>{children}</View>
      )}
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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === "primary" && styles.primary,
        variant === "outline" && styles.outline,
        variant === "link" && styles.link,
        inactive && { opacity: 0.6 },
        pressed && !inactive && { opacity: 0.85 },
      ]}
    >
      {loading ? (
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
      )}
    </Pressable>
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
    minHeight: touchTarget,
    borderRadius: radius.sm,
    paddingHorizontal: space.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: { backgroundColor: colors.primary },
  outline: { borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.surface },
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
  choice: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: touchTarget + 8, padding: space.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: space.lg, gap: space.sm },
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
  if (loading) {
    return (
      <View style={{ paddingVertical: space.xxl, alignItems: "center" }} accessibilityLabel="Loading" accessibilityRole="progressbar">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
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
