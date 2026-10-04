import { Stack } from "expo-router";

import { colors, fonts } from "@/theme";

// Menu tab: the list and product pages stack inside the tab, so the tab bar stays.
export default function MenuStack() {
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: colors.background },
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.primary,
        headerTitleStyle: { fontFamily: fonts.heading, fontSize: 22 },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false, title: "Menu" }} />
      <Stack.Screen name="[slug]" options={{ title: "" }} />
    </Stack>
  );
}
