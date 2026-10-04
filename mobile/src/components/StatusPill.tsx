import { Text, View } from "react-native";

import { ORDER_STATUS_LABELS } from "@/lib/format";
import type { OrderStatus } from "@/lib/types";
import { colors, fonts } from "@/theme";

/** Order status as text (never colour alone); cancelled orders are visibly distinct. */
export function StatusPill({ status }: { status: OrderStatus }) {
  const cancelled = status === "CANCELLED";
  return (
    <View
      style={{
        alignSelf: "flex-start",
        borderRadius: 999,
        borderWidth: 1,
        borderColor: cancelled ? colors.error : colors.border,
        backgroundColor: cancelled ? colors.surface : colors.surfaceMuted,
        paddingHorizontal: 10,
        paddingVertical: 3,
      }}
    >
      <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 12, color: cancelled ? colors.error : colors.text }}>
        {ORDER_STATUS_LABELS[status]}
      </Text>
    </View>
  );
}
