import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { CodeField } from "@/components/CodeField";
import { WhiskDrawing } from "@/components/ornaments";
import { Button, Notice, Screen } from "@/components/ui";
import { authMessage } from "@/lib/auth-messages";
import { supabase } from "@/lib/supabase";
import { useCooldown } from "@/lib/use-cooldown";
import { validateCode, validateEmail } from "@/lib/validation";
import { space, type } from "@/theme";

export default function VerifyEmailScreen() {
  const { email: raw } = useLocalSearchParams<{ email: string }>();
  const email = typeof raw === "string" && !validateEmail(raw) ? raw : null;
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | undefined>();
  const [result, setResult] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const cooldown = useCooldown(60);

  if (!email) {
    return (
      <Screen edges={["left", "right", "bottom"]}>
        <Notice tone="error">Something went wrong. Please create your account again.</Notice>
        <Button label="Create an account" onPress={() => router.replace("/register")} />
      </Screen>
    );
  }

  async function verify() {
    const error = validateCode(code);
    setCodeError(error);
    setResult(null);
    if (error) return;
    setBusy(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({ email: email!, token: code.trim(), type: "signup" });
    setBusy(false);
    if (verifyError) {
      setResult({ tone: "error", message: authMessage(verifyError.code, "That code didn't work. Check it and try again.") });
      return;
    }
    // Email confirmed and signed in on this phone.
    router.dismissAll();
    router.replace("/account");
  }

  async function resend() {
    setResult(null);
    const { error } = await supabase.auth.resend({ type: "signup", email: email! });
    cooldown.start();
    setResult(
      error
        ? { tone: "error", message: authMessage(error.code, "We couldn't send a new code. Please try again.") }
        : { tone: "success", message: "If your account still needs confirming, a new code is on its way." }
    );
  }

  return (
    <Screen edges={["left", "right", "bottom"]}>
      <View style={{ alignItems: "center", gap: space.sm }}>
        <WhiskDrawing size={56} />
        <Text style={[type.display, { textAlign: "center" }]} accessibilityRole="header">
          Check your email
        </Text>
        <Text style={[type.body, { textAlign: "center" }]}>
          Enter the 6-digit code we emailed to <Text style={{ fontWeight: "600" }}>{email}</Text>.
        </Text>
      </View>
      {result ? <Notice tone={result.tone}>{result.message}</Notice> : null}
      <CodeField value={code} onChange={setCode} error={codeError} />
      <Button label="Verify email" onPress={verify} loading={busy} />
      <Button
        label={cooldown.left > 0 ? `Send a new code in ${cooldown.left}s` : "Send a new code"}
        variant="link"
        disabled={cooldown.left > 0}
        onPress={resend}
      />
      <Text style={type.caption}>The code expires after 1 hour. You can also confirm with the link in the same email.</Text>
    </Screen>
  );
}
