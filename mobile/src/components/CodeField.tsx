import { Text, TextInput, View } from "react-native";

import { colors, fonts, radius, space, touchTarget } from "@/theme";

/** A large, spaced 6-digit code input (from the email). */
export function CodeField({ value, onChange, error }: { value: string; onChange: (value: string) => void; error?: string }) {
  return (
    <View style={{ gap: space.xs }}>
      <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text }}>6-digit code</Text>
      <TextInput
        accessibilityLabel="6-digit code"
        value={value}
        onChangeText={(text) => onChange(text.replace(/\D/g, "").slice(0, 6))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="••••••"
        placeholderTextColor={colors.border}
        style={{
          minHeight: touchTarget + 12,
          borderWidth: 1,
          borderColor: error ? colors.error : colors.border,
          borderRadius: radius.lg,
          backgroundColor: colors.surface,
          textAlign: "center",
          fontFamily: fonts.bodySemibold,
          fontSize: 28,
          letterSpacing: 10,
          fontVariant: ["tabular-nums"],
          color: colors.primary,
        }}
      />
      {error ? (
        <Text accessibilityLiveRegion="polite" style={{ fontFamily: fonts.body, fontSize: 13, color: colors.error }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
