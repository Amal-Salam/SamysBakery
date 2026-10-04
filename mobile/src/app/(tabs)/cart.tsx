import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Text, View } from "react-native";

import { useAuth } from "@/auth/AuthProvider";
import { useCart } from "@/cart/CartProvider";
import { BasketDrawing, WheatDivider } from "@/components/ornaments";
import { SignInPrompt } from "@/components/SignInPrompt";
import { GlassHeader } from "@/components/glass";
import { Button, Card, Notice, Screen, StateView, Stepper } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { cartIssueMessage, formatNaira } from "@/lib/format";
import type { CartItem } from "@/lib/types";
import { colors, fonts, radius, space, type } from "@/theme";

function CartLine({ item, onError }: { item: CartItem; onError: (message: string) => void }) {
  const { update, remove } = useCart();
  const [busy, setBusy] = useState(false);
  const issue = cartIssueMessage(item.issue, item.available);
  const canChange = item.issue !== "UNAVAILABLE" && item.issue !== "SOLD_OUT";

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "We couldn't update your cart. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <View style={{ flexDirection: "row", gap: space.md }}>
        {item.image ? (
          <Image source={{ uri: item.image.url }} accessibilityLabel={item.image.alt} style={{ width: 64, height: 64, borderRadius: radius.sm }} />
        ) : null}
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.h2, { fontSize: 20, color: colors.text }]}>{item.name}</Text>
          {item.unitPrice !== null ? <Text style={type.small}>{formatNaira(item.unitPrice)} each</Text> : null}
          {issue ? <Text style={[type.small, { color: colors.error }]}>{issue}</Text> : null}
        </View>
        {item.lineTotal !== null && !item.issue ? (
          <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.text }}>{formatNaira(item.lineTotal)}</Text>
        ) : null}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: space.sm }}>
        {canChange ? (
          <Stepper
            value={item.quantity}
            max={Math.max(item.quantity, Math.min(item.available, 1000))}
            label={item.name}
            disabled={busy}
            onChange={(next) => run(() => update(item.productId, next))}
          />
        ) : (
          <Text style={type.small}>Quantity: {item.quantity}</Text>
        )}
        {item.issue === "EXCEEDS_AVAILABLE" ? (
          <Button label={`Set to ${item.available}`} variant="outline" disabled={busy} onPress={() => run(() => update(item.productId, item.available))} />
        ) : null}
        <Button label={`Remove`} variant="link" disabled={busy} accessibilityHint={`Removes ${item.name} from your cart`} onPress={() => run(() => remove(item.productId))} />
      </View>
    </Card>
  );
}

export default function CartScreen() {
  const { status } = useAuth();
  const { cart, loading, error, refresh, clear } = useCart();
  const [message, setMessage] = useState<string | null>(null);

  if (status !== "signedIn") {
    return (
      <Screen>
        <SignInPrompt illustration={<BasketDrawing />} title="Sign in to see your cart." />
      </Screen>
    );
  }

  const confirmClear = () =>
    Alert.alert("Clear your cart?", "All items will be removed from your cart.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear cart",
        style: "destructive",
        onPress: () => clear().catch(() => setMessage("We couldn't clear your cart. Please try again.")),
      },
    ]);

  return (
    <Screen onRefresh={refresh} refreshing={loading && cart !== null}>
      <GlassHeader>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          <BasketDrawing width={46} height={38} />
          <Text style={type.display} accessibilityRole="header">
            Your Cart
          </Text>
        </View>
      </GlassHeader>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {message ? <Notice tone="error">{message}</Notice> : null}

      {cart === null ? (
        <StateView loading />
      ) : cart.items.length === 0 ? (
        <StateView
          illustration={<BasketDrawing />}
          title="Your cart is empty."
          action={<Button label="View This Week's Menu" onPress={() => router.navigate("/menu")} />}
        />
      ) : (
        <>
          {cart.items.map((item) => (
            <CartLine key={item.productId} item={item} onError={setMessage} />
          ))}
          <WheatDivider />
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 18, color: colors.text }}>Subtotal</Text>
            <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 18, color: colors.text }}>{formatNaira(cart.subtotal)}</Text>
          </View>
          <Text style={type.caption}>Prices and availability are checked again at checkout. Your cart doesn&apos;t hold stock until you pay.</Text>
          {!cart.canCheckout ? <Notice tone="error">Some items in your cart need attention.</Notice> : null}
          <Button label="Checkout" disabled={!cart.canCheckout} onPress={() => router.push("/checkout")} />
          <Button label="Clear cart" variant="link" onPress={confirmClear} />
        </>
      )}
    </Screen>
  );
}
