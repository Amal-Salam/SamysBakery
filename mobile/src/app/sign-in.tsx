import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import { useAuth } from "@/auth/AuthProvider";
import { Button, Field, Notice, Screen } from "@/components/ui";
import { openWebsite } from "@/lib/website";
import { space, type } from "@/theme";

export default function SignInScreen() {
  const { status, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  // Once signed in, go back to where the customer came from.
  useEffect(() => {
    if (status === "signedIn") {
      if (router.canGoBack()) router.back();
      else router.replace("/");
    }
  }, [status]);

  async function submit() {
    const next: typeof errors = {};
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = "Enter a valid email address.";
    if (!password) next.password = "Enter your password.";
    setErrors(next);
    if (next.email || next.password) return;
    setBusy(true);
    const message = await signIn(email, password);
    setBusy(false);
    if (message) setErrors({ form: message });
  }

  return (
    <Screen edges={["left", "right", "bottom"]}>
      <View style={{ gap: space.xs }}>
        <Text style={[type.caption, { letterSpacing: 2, textTransform: "uppercase" }]}>Samy&apos;s Bakery</Text>
        <Text style={type.display} accessibilityRole="header">
          Sign in
        </Text>
      </View>
      {errors.form ? <Notice tone="error">{errors.form}</Notice> : null}
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        error={errors.email}
      />
      <Field
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        error={errors.password}
        onSubmitEditing={submit}
      />
      <Button label="Sign in" onPress={submit} loading={busy} />
      <View style={{ gap: space.xs }}>
        <Button label="New to Samy's Bakery? Create an account" variant="link" onPress={() => openWebsite("register")} />
        <Button label="Forgot your password?" variant="link" onPress={() => openWebsite("resetPassword")} />
        <Text style={type.small}>Signed up with Google? Set a password with &quot;Forgot your password?&quot; to sign in here.</Text>
      </View>
    </Screen>
  );
}
