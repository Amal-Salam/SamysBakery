import { useState } from "react";
import { Text, View } from "react-native";

import { useAuth } from "@/auth/AuthProvider";
import { WheatDivider, WheatDrawing, WhiskDrawing } from "@/components/ornaments";
import { SignInPrompt } from "@/components/SignInPrompt";
import { Button, Screen } from "@/components/ui";
import { openWebsite } from "@/lib/website";
import { space, type } from "@/theme";

export default function AccountScreen() {
  const { status, me, signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  if (status !== "signedIn") {
    return (
      <Screen>
        <SignInPrompt illustration={<WhiskDrawing size={64} />} title="Sign in to your account." />
        <Button label="New to Samy's Bakery? Create an account" variant="link" onPress={() => openWebsite("register")} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <WheatDrawing size={34} />
        <Text style={[type.display, { flexShrink: 1 }]} accessibilityRole="header">
          {me?.fullName ? `Hello, ${me.fullName}` : "Your account"}
        </Text>
      </View>
      {me ? <Text style={type.small}>{me.email}</Text> : null}
      <WheatDivider />
      <View style={{ gap: space.sm }}>
        <Button label="Addresses" variant="outline" onPress={() => openWebsite("addresses")} />
        <Button label="Profile" variant="outline" onPress={() => openWebsite("profile")} />
      </View>
      <Text style={type.caption}>Addresses and profile open on the Samy&apos;s Bakery website.</Text>
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
