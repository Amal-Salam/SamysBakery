import { Redirect } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { useAuth } from "@/auth/AuthProvider";
import { Button, Screen } from "@/components/ui";
import { openWebsite } from "@/lib/website";
import { space, type } from "@/theme";

export default function AccountScreen() {
  const { status, me, signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  if (status === "signedOut") return <Redirect href="/sign-in" />;

  return (
    <Screen>
      <View style={{ gap: space.xs, marginTop: space.xl }}>
        <Text style={type.display} accessibilityRole="header">
          {me?.fullName ? `Hello, ${me.fullName}` : "Your account"}
        </Text>
        {me ? <Text style={type.small}>{me.email}</Text> : null}
      </View>
      <View style={{ gap: space.sm }}>
        <Button label="Addresses" variant="outline" onPress={() => openWebsite("addresses")} />
        <Button label="Profile" variant="outline" onPress={() => openWebsite("profile")} />
      </View>
      <Button
        label="Sign out"
        loading={busy}
        onPress={async () => {
          setBusy(true);
          await signOut();
          setBusy(false);
        }}
      />
    </Screen>
  );
}
