import type { Metadata } from "next";

import { WhiskDrawing } from "@/components/brand/ornaments";
import { AddressBook } from "@/components/account/address-book";
import { listAddresses } from "@/features/customers/addresses";

export const metadata: Metadata = { title: "Addresses" };

export default async function AddressesPage() {
  const addresses = await listAddresses();
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <WhiskDrawing className="size-9 text-primary" />
        <h1 className="text-heading-1 text-primary">Addresses</h1>
      </div>
      <AddressBook addresses={addresses} />
    </div>
  );
}
