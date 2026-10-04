import { Stack } from "expo-router";

import { colors, fonts } from "@/theme";

// Orders tab: the list and order details stack inside the tab.
export default function OrdersStack() {
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
      <Stack.Screen name="index" options={{ headerShown: false, title: "Orders" }} />
      <Stack.Screen name="[orderNumber]" options={{ title: "Order" }} />
    </Stack>
  );
}
