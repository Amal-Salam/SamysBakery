import { router, useLocalSearchParams } from "expo-router";

import { AddressForm } from "@/components/AddressForm";
import { Screen, SkeletonList, StateView } from "@/components/ui";
import type { Address } from "@/lib/types";
import { useApi } from "@/lib/use-api";

// Edit one of the customer's own addresses.
export default function EditAddressScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: addresses, loading } = useApi<Address[]>("/addresses");
  const address = addresses?.find((a) => a.id === id) ?? null;

  if (!addresses && loading) {
    return (
      <Screen edges={["left", "right", "bottom"]}>
        <SkeletonList variant="lines" count={4} />
      </Screen>
    );
  }
  if (!address) {
    return (
      <Screen edges={["left", "right", "bottom"]}>
        <StateView title="That address could not be found." />
      </Screen>
    );
  }
  return (
    <Screen edges={["left", "right", "bottom"]}>
      <AddressForm key={address.id} address={address} onSaved={() => router.back()} />
    </Screen>
  );
}
