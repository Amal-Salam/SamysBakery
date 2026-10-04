import { Tabs } from "expo-router";

import { useCart } from "@/cart/CartProvider";
import { BasketDrawing, LoafDrawing, WheatDrawing, WhiskDrawing } from "@/components/ornaments";
import { colors, fonts } from "@/theme";

export default function TabsLayout() {
  const { cart } = useCart();
  const count = cart?.itemCount ?? 0;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 64, paddingTop: 6 },
        tabBarLabelStyle: { fontFamily: fonts.bodyMedium, fontSize: 12 },
        tabBarBadgeStyle: { backgroundColor: colors.accent, fontFamily: fonts.bodySemibold },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Menu", tabBarIcon: () => <WheatDrawing size={24} /> }} />
      <Tabs.Screen
        name="cart"
        options={{
          title: "Cart",
          tabBarIcon: () => <BasketDrawing width={28} height={24} />,
          tabBarBadge: count > 0 ? count : undefined,
          tabBarAccessibilityLabel: count > 0 ? `Cart, ${count} ${count === 1 ? "item" : "items"}` : "Cart",
        }}
      />
      <Tabs.Screen name="orders" options={{ title: "Orders", tabBarIcon: () => <LoafDrawing size={24} /> }} />
      <Tabs.Screen name="account" options={{ title: "Account", tabBarIcon: () => <WhiskDrawing size={24} /> }} />
    </Tabs>
  );
}
