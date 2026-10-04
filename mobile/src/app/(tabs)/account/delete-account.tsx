import { router } from "expo-router";
import { useState } from "react";
import { Alert, Text } from "react-native";

import { Button, Card, Field, Notice, Screen } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { colors, type } from "@/theme";

const PHRASE = "DELETE";

export default function DeleteAccountScreen() {
  const [confirmation, setConfirmation] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setProblem(null);
    if (confirmation.trim() !== PHRASE) {
      setFieldError(`Type ${PHRASE} to confirm.`);
      return;
    }
    setFieldError(null);
    setBusy(true);
    try {
      await api("/me", { method: "DELETE", body: { confirmation: confirmation.trim() } });
      // The login no longer exists: clear this phone's session.
      await supabase.auth.signOut({ scope: "local" });
      router.replace("/menu");
      Alert.alert("Your account has been deleted.");
    } catch (e) {
      setProblem(e instanceof ApiError ? e.message : "We couldn't delete your account. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen edges={["left", "right"]}>
      <Card>
        <Text style={[type.h2, { color: colors.error }]} accessibilityRole="header">
          Delete account
        </Text>
        <Text style={type.body}>
          Your login, saved addresses, cart and profile will be permanently deleted. Past orders stay in the bakery&apos;s records with your name,
          contact details and address removed. You can&apos;t delete your account while an order is still being prepared or delivered.
        </Text>
      </Card>
      {problem ? <Notice tone="error">{problem}</Notice> : null}
      <Field label={`Type ${PHRASE} to confirm`} value={confirmation} onChangeText={setConfirmation} autoCapitalize="characters" autoCorrect={false} autoComplete="off" error={fieldError} />
      <Button label="Delete my account" onPress={remove} loading={busy} />
    </Screen>
  );
}
