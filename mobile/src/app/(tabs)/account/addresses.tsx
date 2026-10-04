import { router } from "expo-router";
import { useState } from "react";
import { Alert, Text, View } from "react-native";

import { RiseIn } from "@/components/motion";
import { DoodleBadge, WhiskDrawing } from "@/components/ornaments";
import { Button, Card, Notice, Screen, SkeletonList, StateView } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { Address } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { colors, fonts, space, type } from "@/theme";

export default function AddressesScreen() {
  const { data: addresses, error, loading, reload, setData } = useApi<Address[]>("/addresses");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  async function run(id: string, action: () => Promise<Address[]>) {
    setBusyId(id);
    setProblem(null);
    try {
      setData(await action());
    } catch (e) {
      setProblem(e instanceof ApiError ? e.message : "We couldn't update your addresses. Please try again.");
      void reload();
    } finally {
      setBusyId(null);
    }
  }

  const confirmDelete = (address: Address) =>
    Alert.alert(
      `Delete the “${address.label}” address?`,
      address.isDefault ? "Your most recently added remaining address will become your default." : "Past orders keep their own copy of the delivery address.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete address", style: "destructive", onPress: () => run(address.id, () => api<Address[]>(`/addresses/${address.id}`, { method: "DELETE" })) },
      ]
    );

  return (
    <Screen edges={["left", "right"]} onRefresh={reload} refreshing={loading && addresses !== null}>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {problem ? <Notice tone="error">{problem}</Notice> : null}
      {addresses === null ? (
        loading ? <SkeletonList variant="lines" count={2} /> : null
      ) : addresses.length === 0 ? (
        <StateView illustration={<WhiskDrawing size={64} />} title="No saved addresses yet." description="Add one below, or save a new address at checkout." />
      ) : (
        addresses.map((address, i) => (
          <RiseIn key={address.id} index={i}>
            <Card>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space.sm }}>
                <Text style={[type.h2, { color: colors.text, flexShrink: 1 }]}>{address.label}</Text>
                {address.isDefault ? <DoodleBadge tone="accent">Default</DoodleBadge> : null}
              </View>
              <Text style={type.body}>
                {address.recipientName} · {address.phone}
              </Text>
              <Text style={type.body}>{[address.addressLine, address.city, address.state].join(", ")}</Text>
              {address.additionalInfo ? <Text style={type.small}>{address.additionalInfo}</Text> : null}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.lg, marginTop: space.xs }}>
                <Button label={`Edit ${address.label}`} variant="link" disabled={busyId === address.id} onPress={() => router.push({ pathname: "/address/[id]", params: { id: address.id } })} />
                {!address.isDefault ? (
                  <Button
                    label="Make default"
                    variant="link"
                    disabled={busyId === address.id}
                    onPress={() => run(address.id, () => api<Address[]>(`/addresses/${address.id}/default`, { method: "POST" }))}
                  />
                ) : null}
                <Button label="Delete" variant="link" disabled={busyId === address.id} onPress={() => confirmDelete(address)} />
              </View>
            </Card>
          </RiseIn>
        ))
      )}
      <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.textMuted }}>Past orders keep their own copy of the delivery address.</Text>
      <Button label="Add an address" onPress={() => router.push("/address/new")} />
    </Screen>
  );
}
