import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import type { ColorValue } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useCart } from "@/cart/CartProvider";
import { colors, fonts } from "@/theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

/** Standard, recognisable icons: filled when the tab is selected. */
function tabIcon(name: string) {
  const TabIcon = ({ focused, color, size }: { focused: boolean; color: ColorValue; size: number }) => (
    <Ionicons name={(focused ? name : `${name}-outline`) as IconName} color={color as string} size={size} />
  );
  return TabIcon;
}

export default function TabsLayout() {
  const { cart } = useCart();
  const insets = useSafeAreaInsets();
  const count = cart?.itemCount ?? 0;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        // Height follows the phone's own navigation area (Android draws edge to edge).
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 58 + insets.bottom,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 6),
        },
        tabBarLabelStyle: { fontFamily: fonts.bodyMedium, fontSize: 12 },
        tabBarBadgeStyle: { backgroundColor: colors.accent, fontFamily: fonts.bodySemibold },
      }}
    >
      <Tabs.Screen name="menu" options={{ title: "Menu", tabBarIcon: tabIcon("book") }} />
      <Tabs.Screen
        name="cart"
        options={{
          title: "Cart",
          tabBarIcon: tabIcon("bag-handle"),
          tabBarBadge: count > 0 ? count : undefined,
          tabBarAccessibilityLabel: count > 0 ? `Cart, ${count} ${count === 1 ? "item" : "items"}` : "Cart",
        }}
      />
      <Tabs.Screen name="orders" options={{ title: "Orders", tabBarIcon: tabIcon("receipt") }} />
      <Tabs.Screen name="account" options={{ title: "Account", tabBarIcon: tabIcon("person") }} />
    </Tabs>
  );
}
