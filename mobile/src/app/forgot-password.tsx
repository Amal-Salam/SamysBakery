import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { CodeField } from "@/components/CodeField";
import { WhiskDrawing } from "@/components/ornaments";
import { Button, Field, Notice, Screen } from "@/components/ui";
import { config } from "@/config";
import { authMessage } from "@/lib/auth-messages";
import { supabase } from "@/lib/supabase";
import { useCooldown } from "@/lib/use-cooldown";
import { hasErrors, validateEmail, validateResetPassword, type FieldErrors, type NewPasswordInput } from "@/lib/validation";
import { space, type } from "@/theme";

export default function ForgotPasswordScreen() {
  const [step, setStep] = useState<"email" | "code" | "done">("email");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | undefined>();
  const [values, setValues] = useState<NewPasswordInput>({ code: "", password: "", confirmPassword: "" });
  const [errors, setErrors] = useState<FieldErrors<keyof NewPasswordInput>>({});
  const [result, setResult] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const cooldown = useCooldown(60);

  async function sendCode() {
    const error = validateEmail(email);
    setEmailError(error);
    setResult(null);
    if (error) return;
    setBusy(true);
    const { error: sendError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${config.apiUrl}/auth/callback?next=/update-password`,
    });
    setBusy(false);
    cooldown.start();
    if (sendError && sendError.code?.startsWith("over_")) {
      setResult({ tone: "error", message: authMessage(sendError.code, "Please try again.") });
      return;
    }
    // Always the same answer, so the form can't be used to discover accounts.
    setStep("code");
    setResult({ tone: "success", message: "If an account exists for that email, we've sent a code to reset your password." });
  }

  async function reset() {
    const next = validateResetPassword(values);
    setErrors(next);
    setResult(null);
    if (hasErrors(next)) return;
    setBusy(true);
    const address = email.trim().toLowerCase();
    const verified = await supabase.auth.verifyOtp({ email: address, token: values.code.trim(), type: "recovery" });
    if (verified.error) {
      setBusy(false);
      setResult({ tone: "error", message: authMessage(verified.error.code, "That code didn't work. Check it and try again.") });
      return;
    }
    const updated = await supabase.auth.updateUser({ password: values.password });
    setBusy(false);
    if (updated.error) {
      setResult({ tone: "error", message: authMessage(updated.error.code, "We couldn't update your password. Please try again.") });
      return;
    }
    setStep("done");
  }

  if (step === "done") {
    return (
      <Screen edges={["left", "right", "bottom"]}>
        <View style={{ alignItems: "center", gap: space.sm }}>
          <WhiskDrawing size={56} />
          <Text style={[type.display, { textAlign: "center" }]} accessibilityRole="header">
            Password updated
          </Text>
          <Text style={[type.body, { textAlign: "center" }]}>Your password has been updated and you&apos;re signed in.</Text>
        </View>
        <Button
          label="Continue"
          onPress={() => {
            router.dismissAll();
            router.replace("/account");
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen edges={["left", "right", "bottom"]}>
      <View style={{ gap: space.xs }}>
        <Text style={type.display} accessibilityRole="header">
          Reset your password
        </Text>
        <Text style={type.small}>
          {step === "email" ? "Enter your email and we'll send you a 6-digit code." : `Enter the code we emailed to ${email.trim()} and choose a new password.`}
        </Text>
      </View>
      {result ? <Notice tone={result.tone}>{result.message}</Notice> : null}
      {step === "email" ? (
        <>
          <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" error={emailError} />
          <Button label="Send code" onPress={sendCode} loading={busy} />
        </>
      ) : (
        <>
          <CodeField value={values.code} onChange={(code) => setValues((v) => ({ ...v, code }))} error={errors.code} />
          <Field label="New password" value={values.password} onChangeText={(password) => setValues((v) => ({ ...v, password }))} secureTextEntry autoComplete="new-password" textContentType="newPassword" maxLength={72} error={errors.password} />
          <Field label="Confirm new password" value={values.confirmPassword} onChangeText={(confirmPassword) => setValues((v) => ({ ...v, confirmPassword }))} secureTextEntry autoComplete="new-password" maxLength={72} error={errors.confirmPassword} />
          <Button label="Update password" onPress={reset} loading={busy} />
          <Button
            label={cooldown.left > 0 ? `Send a new code in ${cooldown.left}s` : "Send a new code"}
            variant="link"
            disabled={cooldown.left > 0}
            onPress={sendCode}
          />
        </>
      )}
    </Screen>
  );
}
