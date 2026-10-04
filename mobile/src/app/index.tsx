import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "@/auth/AuthProvider";
import { colors } from "@/theme";

// Entry: send the customer to their account or to sign in.
export default function Index() {
  const { status } = useAuth();
  if (status === "loading") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} accessibilityLabel="Loading" />
      </View>
    );
  }
  return <Redirect href={status === "signedIn" ? "/account" : "/sign-in"} />;
}
