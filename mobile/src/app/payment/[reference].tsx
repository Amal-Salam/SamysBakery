import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Text, View } from "react-native";

import { useCart } from "@/cart/CartProvider";
import { BasketDrawing, DoodleBadge, LoafDrawing } from "@/components/ornaments";
import { Button, Notice, Screen, StateView } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { PaymentStatusResult } from "@/lib/types";
import { colors, space, type } from "@/theme";

const REFERENCE = /^SAMY-[0-9A-F]{32}$/;
const POLL_MS = 3000;
const GIVE_UP_MS = 3 * 60 * 1000;

/**
 * After Paystack: asks the server for the verified outcome. The server checks
 * with Paystack itself; nothing the browser tab shows is trusted.
 */
export default function PaymentScreen() {
  const { reference } = useLocalSearchParams<{ reference: string }>();
  const valid = typeof reference === "string" && REFERENCE.test(reference);
  const { refresh: refreshCart } = useCart();
  const [result, setResult] = useState<PaymentStatusResult | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const started = useRef(0);

  const check = useCallback(async () => {
    if (!valid) return;
    try {
      const next = await api<PaymentStatusResult>(`/payments/${reference}`);
      setResult(next);
      setProblem(null);
      if (next.status === "CONFIRMED") void refreshCart();
    } catch (e) {
      setProblem(e instanceof ApiError ? e.message : "We couldn't check your payment yet.");
    }
  }, [valid, reference, refreshCart]);

  const pending = !result || result.status === "PENDING";

  useEffect(() => {
    if (!pending || timedOut) return;
    if (started.current === 0) started.current = Date.now();
    const first = setTimeout(() => void check(), 0);
    const timer = setInterval(() => {
      if (Date.now() - started.current > GIVE_UP_MS) setTimedOut(true);
      else void check();
    }, POLL_MS);
    const sub = AppState.addEventListener("change", (state) => state === "active" && void check());
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      sub.remove();
    };
  }, [pending, timedOut, check]);

  if (!valid) {
    return (
      <Screen edges={["left", "right"]}>
        <StateView title="We couldn't find that payment." action={<Button label="Back to cart" onPress={() => router.navigate("/cart")} />} />
      </Screen>
    );
  }

  if (result?.status === "CONFIRMED") {
    return (
      <Screen edges={["left", "right", "bottom"]}>
        <StateView illustration={<LoafDrawing size={72} />} />
        <Text style={[type.display, { textAlign: "center" }]} accessibilityRole="header">
          Order Confirmed
        </Text>
        <View style={{ alignItems: "center" }}>
          <DoodleBadge tone="accent" shape="oval">{result.orderNumber}</DoodleBadge>
        </View>
        <Text style={[type.body, { textAlign: "center" }]}>
          Thank you! Your payment was received and your order is with the bakery.
        </Text>
        <Button label="View order" onPress={() => router.replace({ pathname: "/orders/[orderNumber]", params: { orderNumber: result.orderNumber } })} />
        <Button label="Continue Browsing" variant="outline" onPress={() => router.navigate("/menu")} />
      </Screen>
    );
  }

  if (result && result.status !== "PENDING") {
    const copy = {
      FAILED: {
        title: "Payment was not completed.",
        description: "You haven't been charged for an order. Your cart is still saved, so you can try again.",
      },
      REFUNDED_LATE: {
        title: "Your payment arrived too late to hold your items.",
        description:
          "Your items were released before the payment completed, so no order was placed. A full refund has been requested automatically; it can take a few business days to appear.",
      },
      REJECTED: {
        title: "We couldn't confirm this payment.",
        description: "No order was placed. If you were charged, our team will review it and contact you.",
      },
    }[result.status];
    return (
      <Screen edges={["left", "right", "bottom"]}>
        <StateView
          illustration={<BasketDrawing />}
          title={copy.title}
          description={copy.description}
          action={<Button label="Back to cart" onPress={() => router.navigate("/cart")} />}
        />
      </Screen>
    );
  }

  return (
    <Screen edges={["left", "right", "bottom"]}>
      <StateView
        illustration={<BasketDrawing />}
        title="We're confirming your payment…"
        description="This usually takes a few seconds. You don't need to pay again. When you've finished on the Paystack page, close it to come back here."
      />
      {timedOut ? (
        <View style={{ gap: space.sm }}>
          <Notice tone="info">
            This is taking longer than usual. If you paid, your order will appear under Orders once Paystack confirms it.
          </Notice>
          <Button
            label="Check again"
            onPress={() => {
              started.current = Date.now();
              setTimedOut(false);
            }}
          />
          <Button label="Go to Orders" variant="outline" onPress={() => router.navigate("/orders")} />
        </View>
      ) : (
        <ActivityIndicator color={colors.primary} accessibilityLabel="Checking payment" style={{ marginTop: space.lg }} />
      )}
      {problem ? <Notice tone="error">{problem}</Notice> : null}
    </Screen>
  );
}
