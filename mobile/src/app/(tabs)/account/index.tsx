import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { useAuth } from "@/auth/AuthProvider";
import { GlassHeader } from "@/components/glass";
import { PressableScale } from "@/components/motion";
import { WheatDrawing, WhiskDrawing } from "@/components/ornaments";
import { SignInPrompt } from "@/components/SignInPrompt";
import { Button, Card, Screen } from "@/components/ui";
import { colors, fonts, space, type } from "@/theme";

function Row({ title, detail, onPress }: { title: string; detail: string; onPress: () => void }) {
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={title} accessibilityHint={detail} onPress={onPress}>
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 16, color: colors.text }}>{title}</Text>
            <Text style={type.small}>{detail}</Text>
          </View>
          <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 22, color: colors.textMuted }} accessibilityElementsHidden>
            ›
          </Text>
        </View>
      </Card>
    </PressableScale>
  );
}

export default function AccountScreen() {
  const { status, me, signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  if (status !== "signedIn") {
    return (
      <Screen>
        <SignInPrompt illustration={<WhiskDrawing size={64} />} title="Sign in to your account." />
        <Button label="New to Samy's Bakery? Create an account" variant="link" onPress={() => router.push("/register")} />
      </Screen>
    );
  }

  return (
    <Screen compactTitle={me?.fullName ? `Hello, ${me.fullName}` : "Your account"}>
      <GlassHeader>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          <WheatDrawing size={34} />
          <Text style={[type.display, { flexShrink: 1 }]} accessibilityRole="header">
            {me?.fullName ? `Hello, ${me.fullName}` : "Your account"}
          </Text>
        </View>
        {me ? <Text style={type.small}>{me.email}</Text> : null}
      </GlassHeader>
      <Row title="Profile" detail="Your name and phone number" onPress={() => router.push("/account/profile")} />
      <Row title="Addresses" detail="Saved delivery addresses" onPress={() => router.push("/account/addresses")} />
      <Button
        label="Sign out"
        loading={busy}
        onPress={async () => {
          setBusy(true);
          await signOut();
          setBusy(false);
        }}
      />
      <Button label="Delete account" variant="link" onPress={() => router.push("/account/delete-account")} />
    </Screen>
  );
}
