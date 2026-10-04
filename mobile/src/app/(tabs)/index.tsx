import { Image } from "expo-image";
import { router } from "expo-router";
import { Fragment } from "react";
import { Pressable, Text, View } from "react-native";

import { DoodleBadge, OvenDrawing, PatternBand, RollingPinDrawing, WheatDivider, WheatDrawing } from "@/components/ornaments";
import { Button, Notice, Screen, StateView } from "@/components/ui";
import { availabilityText, formatNaira, formatWeekRange, groupByCategory } from "@/lib/format";
import type { Menu, Product } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { colors, fonts, radius, space, type } from "@/theme";

const BADGE_TONE = { AVAILABLE: "success", LOW_STOCK: "warning", SOLD_OUT: "filled" } as const;

function ProductCard({ product }: { product: Product }) {
  const availability = availabilityText(product.availabilityStatus, product.availableQuantity);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${product.name}, ${formatNaira(product.price)}, ${availability}`}
      onPress={() => router.push(`/product/${product.slug}`)}
      style={({ pressed }) => ({ gap: space.sm, opacity: pressed ? 0.9 : 1 })}
    >
      {product.image ? (
        <Image
          source={{ uri: product.image.url }}
          accessibilityLabel={product.image.alt}
          contentFit="cover"
          transition={150}
          style={{ width: "100%", aspectRatio: 4 / 3, borderRadius: radius.md, backgroundColor: colors.surfaceMuted }}
        />
      ) : (
        <View style={{ width: "100%", aspectRatio: 4 / 3, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, alignItems: "center", justifyContent: "center", padding: space.lg }}>
          <Text style={[type.h2, { color: colors.textMuted, textAlign: "center" }]}>{product.name}</Text>
        </View>
      )}
      <Text style={[type.h2, { color: colors.text }]}>{product.name}</Text>
      {product.description ? <Text style={type.small} numberOfLines={2}>{product.description}</Text> : null}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 16, color: colors.text }}>{formatNaira(product.price)}</Text>
        <DoodleBadge tone={BADGE_TONE[product.availabilityStatus]}>{availability}</DoodleBadge>
      </View>
    </Pressable>
  );
}

export default function MenuScreen() {
  const { data: menu, error, loading, reload } = useApi<Menu | null>("/menu");
  const groups = menu ? groupByCategory(menu.products) : [];
  const showHeadings = groups.length > 1 || groups.some((group) => group.name);

  return (
    <Screen onRefresh={reload} refreshing={loading && menu !== null}>
      <PatternBand>
        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: space.sm }}>
          <WheatDrawing size={36} />
          <Text style={type.display} accessibilityRole="header">
            This Week&apos;s Menu
          </Text>
        </View>
        <View style={{ marginTop: space.sm }}>
          <DoodleBadge tone="accent" shape="oval">This week only</DoodleBadge>
        </View>
        {menu ? <Text style={[type.h2, { fontSize: 20, marginTop: space.md }]}>{formatWeekRange(menu.weekStart, menu.weekEnd)}</Text> : null}
        <Text style={[type.small, { marginTop: space.xs }]}>
          A new selection of cakes, breads, and pastries, thoughtfully chosen for the week.
        </Text>
      </PatternBand>

      {error ? (
        <>
          <Notice tone="error">{error}</Notice>
          <Button label="Try again" variant="outline" onPress={reload} />
        </>
      ) : loading && menu === null ? (
        <StateView loading />
      ) : !menu || menu.products.length === 0 ? (
        <StateView
          illustration={<OvenDrawing />}
          title="No products are currently available."
          description="This week's menu hasn't been published yet. Please check back soon."
        />
      ) : (
        groups.map((group, index) => (
          <Fragment key={group.name ?? "uncategorized"}>
            {index > 0 ? <WheatDivider style={{ marginVertical: space.sm }} /> : null}
            <View style={{ gap: space.lg }}>
              {showHeadings ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                  <RollingPinDrawing size={30} />
                  <Text style={type.h1} accessibilityRole="header">
                    {group.name ?? "Also this week"}
                  </Text>
                </View>
              ) : null}
              {group.products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </View>
          </Fragment>
        ))
      )}
    </Screen>
  );
}
