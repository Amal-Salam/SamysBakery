import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, Text, View } from "react-native";

import { LoafDrawing, WheatDivider } from "@/components/ornaments";
import { StatusPill } from "@/components/StatusPill";
import { Button, Card, Notice, Screen, SkeletonList, StateView } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { DELIVERY_FEE_NOTE, formatLongDate, formatNaira, formatShortDate } from "@/lib/format";
import type { OrderDetail } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { colors, fonts, space, type } from "@/theme";

const ORDER_NUMBER = /^SAM-\d{4,}$/;

export default function OrderScreen() {
  const { orderNumber } = useLocalSearchParams<{ orderNumber: string }>();
  const valid = typeof orderNumber === "string" && ORDER_NUMBER.test(orderNumber);
  const { data: order, error, loading, reload, setData } = useApi<OrderDetail>(valid ? `/orders/${orderNumber}` : null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  if (!valid || (error && !order)) {
    return (
      <Screen edges={["left", "right"]}>
        <StateView illustration={<LoafDrawing size={64} />} title="That order could not be found." />
      </Screen>
    );
  }
  if (!order) {
    return (
      <Screen edges={["left", "right"]}>
        <SkeletonList variant="lines" count={4} />
      </Screen>
    );
  }

  const cancel = () =>
    Alert.alert(`Cancel ${order.orderNumber}?`, "The bakery will stop preparing your order. Refunds are handled by the bakery separately.", [
      { text: "Keep order", style: "cancel" },
      {
        text: "Yes, cancel my order",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          setProblem(null);
          try {
            setData(await api<OrderDetail>(`/orders/${order.orderNumber}/cancel`, { method: "POST" }));
          } catch (e) {
            setProblem(e instanceof ApiError ? e.message : "We couldn't cancel the order. Please try again.");
            void reload();
          } finally {
            setBusy(false);
          }
        },
      },
    ]);

  return (
    <Screen edges={["left", "right", "bottom"]} onRefresh={reload} refreshing={loading}>
      <Stack.Screen options={{ title: order.orderNumber }} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap" }}>
        <LoafDrawing size={32} />
        <Text style={type.h1} accessibilityRole="header">
          {order.orderNumber}
        </Text>
        <StatusPill status={order.orderStatus} />
      </View>
      <Text style={type.small}>Placed {formatShortDate(order.placedAt.slice(0, 10), true)}</Text>
      {problem ? <Notice tone="error">{problem}</Notice> : null}

      <Card>
        {order.items.map((item, index) => (
          <View key={`${item.name}-${index}`} style={{ flexDirection: "row", justifyContent: "space-between", gap: space.md }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text }}>{item.name}</Text>
              <Text style={type.small}>
                {item.quantity} × {formatNaira(item.unitPrice)}
              </Text>
            </View>
            <Text style={[type.price, { fontFamily: fonts.bodyMedium }]}>{formatNaira(item.lineTotal)}</Text>
          </View>
        ))}
        <WheatDivider />
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 18, color: colors.text }}>Subtotal</Text>
          <Text style={[type.price, { fontSize: 18 }]}>{formatNaira(order.subtotal)}</Text>
        </View>
      </Card>

      <Card>
        <Text style={type.caption}>Delivery date</Text>
        <Text style={type.body}>{formatLongDate(order.deliveryDate)}</Text>
        <Text style={[type.caption, { marginTop: space.sm }]}>Delivery address</Text>
        <Text style={type.body}>
          {order.recipientName} · {order.phone}
        </Text>
        <Text style={type.body}>{order.address}</Text>
        {order.additionalInfo ? <Text style={type.small}>{order.additionalInfo}</Text> : null}
        <Text style={[type.caption, { marginTop: space.sm }]}>Notes</Text>
        <Text style={type.body}>{order.specialNotes ?? "None"}</Text>
      </Card>
      <Text style={type.small}>{DELIVERY_FEE_NOTE}</Text>

      {order.canCancel ? (
        <Card>
          <Text style={type.h2}>Need to cancel?</Text>
          <Text style={type.small}>You can cancel until your order is ready. Refunds are handled by the bakery after cancellation.</Text>
          <Button label="Cancel order" variant="outline" loading={busy} onPress={cancel} />
        </Card>
      ) : order.orderStatus === "CANCELLED" ? (
        <Notice tone="info">
          {`This order was cancelled. ${
            order.paymentStatus === "REFUNDED" ? "Your payment has been refunded." : "Any refund is handled by the bakery and can take a few business days."
          }`}
        </Notice>
      ) : null}
    </Screen>
  );
}
