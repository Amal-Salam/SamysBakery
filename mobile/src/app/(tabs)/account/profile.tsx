import { useState } from "react";
import { Text } from "react-native";

import { useAuth, type Me } from "@/auth/AuthProvider";
import { Button, Field, Notice, Screen, SkeletonList } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { hasErrors, validateProfile, type FieldErrors, type ProfileInput } from "@/lib/validation";
import { type } from "@/theme";

function ProfileForm({ me }: { me: Me }) {
  const { updateMe } = useAuth();
  const [values, setValues] = useState<ProfileInput>({ fullName: me.fullName, phone: me.phone ?? "" });
  const [errors, setErrors] = useState<FieldErrors<keyof ProfileInput>>({});
  const [result, setResult] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    const next = validateProfile(values);
    setErrors(next);
    setResult(null);
    if (hasErrors(next)) return;
    setBusy(true);
    try {
      updateMe(await api<Me>("/me", { method: "PATCH", body: values }));
      setResult({ tone: "success", message: "Profile saved." });
    } catch (e) {
      setResult({ tone: "error", message: e instanceof ApiError ? e.message : "We couldn't save your profile. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {result ? <Notice tone={result.tone}>{result.message}</Notice> : null}
      <Field label="Full name" value={values.fullName} onChangeText={(fullName) => setValues((v) => ({ ...v, fullName }))} autoComplete="name" maxLength={120} error={errors.fullName} />
      <Field label="Phone number (optional)" value={values.phone} onChangeText={(phone) => setValues((v) => ({ ...v, phone }))} keyboardType="phone-pad" autoComplete="tel" maxLength={30} error={errors.phone} />
      <Text style={type.caption}>Email: {me.email}</Text>
      <Button label="Save profile" onPress={save} loading={busy} />
    </>
  );
}

export default function ProfileScreen() {
  const { me } = useAuth();
  return (
    <Screen edges={["left", "right"]}>
      {me ? <ProfileForm key={me.id} me={me} /> : <SkeletonList variant="lines" count={2} />}
    </Screen>
  );
}
