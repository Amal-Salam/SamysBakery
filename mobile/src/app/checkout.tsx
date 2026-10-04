import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Text, TextInput, View } from "react-native";

import { BasketDrawing, WheatDivider } from "@/components/ornaments";
import { Button, Card, Choice, Notice, Screen, StateView } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { DELIVERY_FEE_NOTE, formatDeliveryDate, formatLongDate, formatNaira } from "@/lib/format";
import type { CheckoutContext, CheckoutSummary } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { openWebsite } from "@/lib/website";
import { colors, fonts, radius, space, type } from "@/theme";

const NOTES_MAX = 500;

export default function CheckoutScreen() {
  const { data: context, error, loading, reload } = useApi<CheckoutContext>("/checkout");
  const [chosenAddressId, setAddressId] = useState<string | null>(null);
  const [chosenDate, setDeliveryDate] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [summary, setSummary] = useState<CheckoutSummary | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The customer's choice if still valid, otherwise the default address and earliest date.
  const addressId =
    context && chosenAddressId && context.addresses.some((a) => a.id === chosenAddressId)
      ? chosenAddressId
      : (context?.addresses.find((a) => a.isDefault)?.id ?? context?.addresses[0]?.id ?? null);
  const deliveryDate =
    context && chosenDate && context.deliveryDates.includes(chosenDate) ? chosenDate : (context?.deliveryDates[0] ?? null);

  if (loading && !context) {
    return (
      <Screen edges={["left", "right"]}>
        <StateView loading />
      </Screen>
    );
  }
  if (error && !context) {
    return (
      <Screen edges={["left", "right"]}>
        <Notice tone="error">{error}</Notice>
        <Button label="Try again" variant="outline" onPress={reload} />
      </Screen>
    );
  }
  if (!context) return null;

  async function review() {
    if (!addressId || !deliveryDate) return;
    setBusy(true);
    setProblem(null);
    try {
      setSummary(await api<CheckoutSummary>("/checkout/review", { method: "POST", body: { deliveryDate, addressId, specialNotes: notes } }));
    } catch (e) {
      setProblem(e instanceof ApiError ? e.message : "We couldn't prepare your order. Please try again.");
      void reload();
    } finally {
      setBusy(false);
    }
  }

  async function pay() {
    if (!summary) return;
    setBusy(true);
    setProblem(null);
    try {
      // The server holds the stock and sets the amount; the app sends no price.
      const { authorizationUrl, reference } = await api<{ authorizationUrl: string; reference: string }>("/payments", {
        method: "POST",
        body: { deliveryDate: summary.deliveryDate, addressId: summary.address.id, specialNotes: summary.specialNotes ?? "" },
      });
      router.replace({ pathname: "/payment/[reference]", params: { reference } });
      // Paystack opens in a secure browser tab (Chrome Custom Tab), never inside the app.
      await WebBrowser.openBrowserAsync(authorizationUrl);
    } catch (e) {
      setProblem(e instanceof ApiError ? e.message : "We couldn't start the payment. Please try again.");
      setBusy(false);
    }
  }

  if (summary) {
    return (
      <Screen edges={["left", "right", "bottom"]}>
        <Text style={type.h1} accessibilityRole="header">
          Review your order
        </Text>
        {problem ? <Notice tone="error">{problem}</Notice> : null}
        <Card>
          {summary.lines.map((line) => (
            <View key={line.productId} style={{ flexDirection: "row", justifyContent: "space-between", gap: space.md }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text }}>{line.name}</Text>
                <Text style={type.small}>
                  {line.quantity} × {formatNaira(line.unitPrice)}
                </Text>
              </View>
              <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text }}>{formatNaira(line.lineTotal)}</Text>
            </View>
          ))}
          <WheatDivider />
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 18, color: colors.text }}>Subtotal</Text>
            <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 18, color: colors.text }}>{formatNaira(summary.subtotal)}</Text>
          </View>
        </Card>
        <Card>
          <Text style={type.caption}>Delivery date</Text>
          <Text style={type.body}>{formatLongDate(summary.deliveryDate)}</Text>
          <Text style={[type.caption, { marginTop: space.sm }]}>Delivery address</Text>
          <Text style={type.body}>
            {summary.address.recipientName} · {summary.address.phone}
          </Text>
          <Text style={type.body}>{[summary.address.addressLine, summary.address.city, summary.address.state].join(", ")}</Text>
          <Text style={[type.caption, { marginTop: space.sm }]}>Notes</Text>
          <Text style={type.body}>{summary.specialNotes ?? "None"}</Text>
        </Card>
        <Text style={type.small}>{DELIVERY_FEE_NOTE}</Text>
        <Button label="Pay with Paystack" onPress={pay} loading={busy} />
        <Button label="Change delivery details" variant="outline" disabled={busy} onPress={() => setSummary(null)} />
      </Screen>
    );
  }

  return (
    <Screen edges={["left", "right", "bottom"]} onRefresh={reload} refreshing={loading}>
      <Text style={type.small}>
        Signed in as {context.customer.name || context.customer.email}
      </Text>
      {problem ? <Notice tone="error">{problem}</Notice> : null}

      <Text style={type.h2} accessibilityRole="header">
        Delivery address
      </Text>
      {context.addresses.length === 0 ? (
        <StateView
          illustration={<BasketDrawing width={80} height={66} />}
          description="Add a delivery address on the Samy's Bakery website, then come back and pull down to refresh."
          action={<Button label="Add an address" variant="outline" onPress={() => openWebsite("addresses")} />}
        />
      ) : (
        <View accessibilityRole="radiogroup" style={{ gap: space.sm }}>
          {context.addresses.map((address) => (
            <Choice
              key={address.id}
              selected={address.id === addressId}
              onPress={() => setAddressId(address.id)}
              title={address.label}
              detail={`${address.recipientName} · ${[address.addressLine, address.city, address.state].join(", ")}`}
            />
          ))}
        </View>
      )}

      <Text style={type.h2} accessibilityRole="header">
        Delivery date
      </Text>
      {context.deliveryDates.length === 0 ? (
        <Notice tone="info">Ordering for this week has closed.</Notice>
      ) : (
        <View accessibilityRole="radiogroup" style={{ gap: space.sm }}>
          {context.deliveryDates.map((date) => (
            <Choice key={date} selected={date === deliveryDate} onPress={() => setDeliveryDate(date)} title={formatDeliveryDate(date, context.today)} />
          ))}
        </View>
      )}

      <View style={{ gap: space.xs }}>
        <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text }}>Special notes (optional)</Text>
        <TextInput
          accessibilityLabel="Special notes (optional)"
          value={notes}
          onChangeText={(value) => setNotes(value.slice(0, NOTES_MAX))}
          multiline
          maxLength={NOTES_MAX}
          style={{
            minHeight: 96,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.sm,
            backgroundColor: colors.surface,
            padding: space.md,
            fontFamily: fonts.body,
            fontSize: 16,
            color: colors.text,
            textAlignVertical: "top",
          }}
        />
        <Text style={type.caption}>
          {notes.length}/{NOTES_MAX} characters
        </Text>
      </View>
      <Text style={type.small}>{DELIVERY_FEE_NOTE}</Text>
      <Button label="Review order" onPress={review} loading={busy} disabled={!addressId || !deliveryDate} />
    </Screen>
  );
}
