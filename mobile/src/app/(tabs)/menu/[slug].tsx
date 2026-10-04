import { Image } from "expo-image";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { useAuth } from "@/auth/AuthProvider";
import { useCart } from "@/cart/CartProvider";
import { DoodleBadge, LoafDrawing, WheatDivider } from "@/components/ornaments";
import { Button, Notice, Screen, StateView, Stepper } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { availabilityText, formatNaira } from "@/lib/format";
import type { Product } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { colors, fonts, radius, space, type } from "@/theme";

const BADGE_TONE = { AVAILABLE: "success", LOW_STOCK: "warning", SOLD_OUT: "filled" } as const;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export default function ProductScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const valid = typeof slug === "string" && SLUG.test(slug);
  const { data: product, error, loading, reload } = useApi<Product>(valid ? `/menu/${slug}` : null);
  const { status } = useAuth();
  const { add } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  if (!valid || (error && !product)) {
    return (
      <Screen edges={["left", "right"]}>
        <StateView
          illustration={<LoafDrawing size={64} />}
          title="This product isn't on this week's menu."
          action={<Button label="Back to Weekly Menu" variant="outline" onPress={() => router.navigate("/menu")} />}
        />
      </Screen>
    );
  }
  if (loading && !product) {
    return (
      <Screen edges={["left", "right"]}>
        <StateView loading />
      </Screen>
    );
  }
  if (!product) return null;

  const soldOut = product.availabilityStatus === "SOLD_OUT";
  const max = Math.max(1, Math.min(product.availableQuantity, 1000));

  async function addToCart() {
    if (status !== "signedIn") {
      router.push("/sign-in");
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      await add(product!.id, quantity);
      setResult({ tone: "success", message: "Added to cart." });
      void reload();
    } catch (e) {
      setResult({ tone: "error", message: e instanceof ApiError ? e.message : "We couldn't add that. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen edges={["left", "right"]} onRefresh={reload} refreshing={loading}>
      <Stack.Screen options={{ title: "" }} />
      {product.image ? (
        <Image
          source={{ uri: product.image.url }}
          accessibilityLabel={product.image.alt}
          contentFit="cover"
          style={{ width: "100%", aspectRatio: 1, borderRadius: radius.lg, backgroundColor: colors.surfaceMuted }}
        />
      ) : null}
      <Text style={type.display} accessibilityRole="header">
        {product.name}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.lg, flexWrap: "wrap" }}>
        <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 22, color: colors.text }}>{formatNaira(product.price)}</Text>
        <DoodleBadge tone={BADGE_TONE[product.availabilityStatus]}>
          {availabilityText(product.availabilityStatus, product.availableQuantity)}
        </DoodleBadge>
      </View>
      {product.description ? <Text style={type.body}>{product.description}</Text> : null}

      {soldOut ? (
        <Notice tone="info">This product is sold out for this week.</Notice>
      ) : (
        <View style={{ gap: space.md }}>
          <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text }}>Quantity</Text>
          <Stepper value={quantity} max={max} onChange={setQuantity} label={product.name} disabled={busy} />
          <Button label={status === "signedIn" ? "Add to Cart" : "Sign in to add to cart"} onPress={addToCart} loading={busy} />
        </View>
      )}
      {result ? (
        <View style={{ gap: space.sm }}>
          <Notice tone={result.tone}>{result.message}</Notice>
          {result.tone === "success" ? <Button label="View cart" variant="link" onPress={() => router.navigate("/cart")} /> : null}
        </View>
      ) : null}

      {product.ingredients ? (
        <>
          <WheatDivider />
          <Text style={type.h2} accessibilityRole="header">
            Ingredients
          </Text>
          <Text style={type.body}>{product.ingredients}</Text>
        </>
      ) : null}
    </Screen>
  );
}
