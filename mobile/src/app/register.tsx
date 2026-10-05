import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { Button, Field, Notice, Screen } from "@/components/ui";
import { config } from "@/config";
import { authMessage } from "@/lib/auth-messages";
import { supabase } from "@/lib/supabase";
import { hasErrors, validateRegistration, type FieldErrors, type RegistrationInput } from "@/lib/validation";
import { space, type } from "@/theme";

export default function RegisterScreen() {
  const [values, setValues] = useState<RegistrationInput>({ fullName: "", email: "", password: "" });
  const [errors, setErrors] = useState<FieldErrors<keyof RegistrationInput>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (key: keyof RegistrationInput) => (text: string) => setValues((v) => ({ ...v, [key]: text }));

  async function submit() {
    const next = validateRegistration(values);
    setErrors(next);
    setProblem(null);
    if (hasErrors(next)) return;
    setBusy(true);
    const email = values.email.trim().toLowerCase();
    // Created directly with Supabase Auth from this phone (its own per-device limits
    // apply). The email has a link (website) and a 6-digit code (this app).
    const { error } = await supabase.auth.signUp({
      email,
      password: values.password,
      options: { data: { full_name: values.fullName.trim() }, emailRedirectTo: `${config.apiUrl}/auth/callback?next=/` },
    });
    setBusy(false);
    if (error) {
      setProblem(authMessage(error.code, "We couldn't create your account. Please try again."));
      return;
    }
    // Same response whether or not the email already has an account (no account enumeration).
    router.replace({ pathname: "/verify-email", params: { email } });
  }

  return (
    <Screen edges={["left", "right", "bottom"]}>
      <View style={{ gap: space.xs }}>
        <Text style={type.display} accessibilityRole="header">
          Create an account
        </Text>
        <Text style={type.small}>You&apos;ll confirm your email with a 6-digit code.</Text>
      </View>
      {problem ? <Notice tone="error">{problem}</Notice> : null}
      <Field label="Full name" value={values.fullName} onChangeText={set("fullName")} autoComplete="name" maxLength={120} error={errors.fullName} />
      <Field label="Email" value={values.email} onChangeText={set("email")} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" error={errors.email} />
      <Field label="Password" value={values.password} onChangeText={set("password")} secureTextEntry autoComplete="new-password" textContentType="newPassword" maxLength={72} error={errors.password} />
      <Text style={type.caption}>At least 8 characters.</Text>
      <Button label="Create account" onPress={submit} loading={busy} />
      <Button label="Already have an account? Sign in" variant="link" onPress={() => router.replace("/sign-in")} />
    </Screen>
  );
}
