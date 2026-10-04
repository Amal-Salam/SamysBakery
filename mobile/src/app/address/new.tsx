import { router } from "expo-router";

import { AddressForm } from "@/components/AddressForm";
import { Screen } from "@/components/ui";

// Add an address (sheet above the app; used from Addresses and from checkout).
export default function NewAddressScreen() {
  return (
    <Screen edges={["left", "right", "bottom"]}>
      <AddressForm onSaved={() => router.back()} />
    </Screen>
  );
}
