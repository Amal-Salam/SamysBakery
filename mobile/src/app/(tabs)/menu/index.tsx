import { Image } from "expo-image";
import { router } from "expo-router";
import { Fragment } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { PressableScale, RiseIn } from "@/components/motion";
import { DoodleBadge, LoafDrawing, OvenDrawing, RollingPinDrawing, WheatDivider, WheatDrawing } from "@/components/ornaments";
import { GlassHeader } from "@/components/glass";
import { Button, Notice, Screen, SkeletonList, StateView } from "@/components/ui";
import { availabilityText, formatNaira, formatWeekRange, groupByCategory } from "@/lib/format";
import type { Menu, Product } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { colors, radius, softShadow, space, type } from "@/theme";

const BADGE_TONE = { AVAILABLE: "success", LOW_STOCK: "warning", SOLD_OUT: "filled" } as const;

/** Warm gradient with a small drawing for products without a photo. */
function PhotoPlaceholder() {
  return (
    <View style={{ width: "100%", aspectRatio: 5 / 4, alignItems: "center", justifyContent: "center" }}>
      <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="warm" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#F3E3CF" />
            <Stop offset="1" stopColor="#E3C6A6" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#warm)" />
      </Svg>
      <LoafDrawing size={64} />
    </View>
  );
}

function ProductCard({ product, index }: { product: Product; index: number }) {
  const availability = availabilityText(product.availabilityStatus, product.availableQuantity);
  return (
    <RiseIn index={index}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${product.name}, ${formatNaira(product.price)}, ${availability}`}
        onPress={() => router.push(`/menu/${product.slug}`)}
        style={styles.card}
      >
        <View style={styles.cardClip}>
          {product.image ? (
            <Image
              source={{ uri: product.image.url }}
              accessibilityLabel={product.image.alt}
              contentFit="cover"
              transition={450}
              style={{ width: "100%", aspectRatio: 5 / 4, backgroundColor: colors.surfaceMuted }}
            />
          ) : (
            <PhotoPlaceholder />
          )}
          <View style={{ padding: space.lg, gap: space.xs }}>
            <Text style={[type.h2, { color: colors.text }]}>{product.name}</Text>
            {product.description ? (
              <Text style={type.small} numberOfLines={2}>
                {product.description}
              </Text>
            ) : null}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: space.xs }}>
              <Text style={[type.price, { fontSize: 17 }]}>{formatNaira(product.price)}</Text>
              <DoodleBadge tone={BADGE_TONE[product.availabilityStatus]}>{availability}</DoodleBadge>
            </View>
          </View>
        </View>
      </PressableScale>
    </RiseIn>
  );
}

export default function MenuScreen() {
  const { data: menu, error, loading, reload } = useApi<Menu | null>("/menu");
  const groups = menu ? groupByCategory(menu.products) : [];
  const showHeadings = groups.length > 1 || groups.some((group) => group.name);

  return (
    <Screen onRefresh={reload} refreshing={loading && menu !== null} compactTitle="This Week's Menu">
      <GlassHeader>
        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: space.sm }}>
          <WheatDrawing size={36} />
          <Text style={type.display} accessibilityRole="header">
            This Week&apos;s Menu
          </Text>
        </View>
        <View style={{ marginTop: space.sm }}>
          <DoodleBadge tone="accent" shape="oval">This week only</DoodleBadge>
        </View>
        {menu ? <Text style={[type.accent, { marginTop: space.md }]}>{formatWeekRange(menu.weekStart, menu.weekEnd)}</Text> : null}
        <Text style={[type.small, { marginTop: space.xs }]}>
          A new selection of cakes, breads, and pastries, thoughtfully chosen for the week.
        </Text>
      </GlassHeader>

      {error ? (
        <>
          <Notice tone="error">{error}</Notice>
          <Button label="Try again" variant="outline" onPress={reload} />
        </>
      ) : loading && menu === null ? (
        <SkeletonList variant="cards" />
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
            <View style={{ gap: space.xl }}>
              {showHeadings ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                  <RollingPinDrawing size={30} />
                  <Text style={type.h1} accessibilityRole="header">
                    {group.name ?? "Also this week"}
                  </Text>
                </View>
              ) : null}
              {group.products.map((product, i) => (
                <ProductCard key={product.id} product={product} index={i} />
              ))}
            </View>
          </Fragment>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Soft shadow on the outer view; the inner view clips the photo to the rounded corners.
  card: { borderRadius: radius.xl, backgroundColor: colors.surface, ...softShadow },
  cardClip: { borderRadius: radius.xl, overflow: "hidden" },
});
