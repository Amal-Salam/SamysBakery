import { router } from "expo-router";
import { Text, View } from "react-native";

import { useAuth } from "@/auth/AuthProvider";
import { LoafDrawing } from "@/components/ornaments";
import { SignInPrompt } from "@/components/SignInPrompt";
import { StatusPill } from "@/components/StatusPill";
import { PressableScale, RiseIn } from "@/components/motion";
import { Button, Card, Notice, Screen, SkeletonList, StateView } from "@/components/ui";
import { formatLongDate, formatNaira, formatShortDate } from "@/lib/format";
import type { OrderSummary } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { colors, space, type } from "@/theme";

export default function OrdersScreen() {
  const { status } = useAuth();
  const { data: orders, error, loading, reload } = useApi<OrderSummary[]>(status === "signedIn" ? "/orders" : null);

  if (status !== "signedIn") {
    return (
      <Screen>
        <SignInPrompt illustration={<LoafDrawing size={64} />} title="Sign in to see your orders." />
      </Screen>
    );
  }

  return (
    <Screen onRefresh={reload} refreshing={loading && orders !== null} compactTitle="Your orders">
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <LoafDrawing size={36} />
        <Text style={type.display} accessibilityRole="header">
          Your orders
        </Text>
      </View>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {orders === null ? (
        loading ? <SkeletonList variant="lines" count={3} /> : null
      ) : orders.length === 0 ? (
        <StateView
          illustration={<LoafDrawing size={64} />}
          title="You haven't placed any orders yet."
          action={<Button label="View This Week's Menu" onPress={() => router.navigate("/menu")} />}
        />
      ) : (
        orders.map((order, i) => (
          <RiseIn key={order.orderNumber} index={i}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`${order.orderNumber}, ${formatNaira(order.subtotal)}, delivery ${formatLongDate(order.deliveryDate)}`}
            onPress={() => router.push({ pathname: "/orders/[orderNumber]", params: { orderNumber: order.orderNumber } })}
          >
            <Card>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={[type.h2, { color: colors.text }]}>{order.orderNumber}</Text>
                <StatusPill status={order.orderStatus} />
              </View>
              <Text style={type.caption}>Placed {formatShortDate(order.placedAt.slice(0, 10), true)}</Text>
              <Text style={type.body}>{order.items.map((item) => `${item.quantity} × ${item.name}`).join(", ")}</Text>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={type.small}>Delivery: {formatLongDate(order.deliveryDate)}</Text>
                <Text style={type.price}>{formatNaira(order.subtotal)}</Text>
              </View>
            </Card>
          </PressableScale>
          </RiseIn>
        ))
      )}
    </Screen>
  );
}
