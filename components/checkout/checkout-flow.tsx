"use client";

import { Truck } from "lucide-react";
import Link from "next/link";
import { useActionState, useId, useState } from "react";

import { prepareCheckoutAction } from "@/actions/checkout";
import { Button } from "@/components/ui/button";
import { FormError, FormField, SubmitButton, TextareaField, fieldErrorsOf } from "@/components/ui/form";
import type { EvaluatedCart } from "@/features/cart/rules";
import type { CheckoutContext, CheckoutSummary } from "@/features/checkout/service";
import { formatNaira } from "@/features/weekly-menu/rules";
import { formatClockTime, formatDeliveryDate, formatLongDate } from "@/lib/utils/dates";
import { SPECIAL_NOTES_MAX } from "@/schemas/checkout";
import type { ActionResult } from "@/types/api";

import { CheckoutStepIndicator, type CheckoutStep } from "./checkout-steps";

const EMPTY_ADDRESS = {
  label: "",
  recipientName: "",
  phone: "",
  addressLine: "",
  city: "",
  state: "",
  additionalInfo: "",
};

export function CheckoutFlow({ context, cart }: { context: CheckoutContext; cart: EvaluatedCart }) {
  const [step, setStep] = useState<CheckoutStep>("Customer");
  const [summary, setSummary] = useState<CheckoutSummary | null>(null);

  // Delivery selections survive moving between steps.
  const defaultAddress = context.addresses.find((address) => address.isDefault) ?? context.addresses[0];
  const [addressChoice, setAddressChoice] = useState<string>(defaultAddress?.id ?? "new");
  const [newAddress, setNewAddress] = useState({
    ...EMPTY_ADDRESS,
    recipientName: context.user.fullName,
    phone: context.user.phone ?? "",
  });
  const [deliveryDate, setDeliveryDate] = useState(context.deliveryDates[0] ?? "");
  const [specialNotes, setSpecialNotes] = useState("");

  const [state, action] = useActionState(
    async (prev: ActionResult<CheckoutSummary> | null, formData: FormData) => {
      const result = await prepareCheckoutAction(prev, formData);
      if (result.success) {
        setSummary(result.data);
        // A new address is saved to the account; select it so it isn't saved twice.
        setAddressChoice(result.data.address.id);
        setNewAddress({ ...EMPTY_ADDRESS, recipientName: context.user.fullName, phone: context.user.phone ?? "" });
        setStep("Review");
      }
      return result;
    },
    null
  );
  const errors = fieldErrorsOf(state);

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_20rem]">
      <div className="flex flex-col gap-8">
        <CheckoutStepIndicator current={step} />

        {step === "Customer" ? (
          <section aria-labelledby="customer-heading" className="flex flex-col gap-5">
            <h2 id="customer-heading" className="text-heading-2 text-primary">
              Your details
            </h2>
            <dl className="grid gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2">
              <div>
                <dt className="text-caption text-muted-foreground">Name</dt>
                <dd className="font-medium">{context.user.fullName || "—"}</dd>
              </div>
              <div>
                <dt className="text-caption text-muted-foreground">Email</dt>
                <dd className="font-medium break-all">{context.user.email}</dd>
              </div>
            </dl>
            <p className="text-body-sm text-muted-foreground">
              Your order confirmation will be sent to this email address.
            </p>
            <Button size="lg" className="self-start" onClick={() => setStep("Delivery")}>
              Continue to delivery
            </Button>
          </section>
        ) : null}

        {step === "Delivery" ? (
          <form action={action} className="flex flex-col gap-8" noValidate aria-labelledby="delivery-heading">
            <h2 id="delivery-heading" className="text-heading-2 text-primary">
              Delivery
            </h2>
            <FormError state={state} />

            <fieldset className="flex flex-col gap-3">
              <legend className="mb-2 font-heading text-heading-3">Delivery address</legend>
              {context.addresses.map((address) => (
                <label
                  key={address.id}
                  className="flex cursor-pointer gap-3 rounded-lg border border-border bg-surface p-4 has-checked:border-primary"
                >
                  <input
                    type="radio"
                    name="addressChoice"
                    value={address.id}
                    checked={addressChoice === address.id}
                    onChange={() => setAddressChoice(address.id)}
                    className="mt-1"
                  />
                  <span className="flex flex-col gap-0.5 text-body-sm">
                    <span className="font-medium">
                      {address.label}
                      {address.isDefault ? <span className="text-muted-foreground"> · Default</span> : null}
                    </span>
                    <span>
                      {address.recipientName} · {address.phone}
                    </span>
                    <span className="text-muted-foreground">
                      {[address.addressLine, address.city, address.state].join(", ")}
                    </span>
                  </span>
                </label>
              ))}
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-surface p-4 has-checked:border-primary">
                <input
                  type="radio"
                  name="addressChoice"
                  value="new"
                  checked={addressChoice === "new"}
                  onChange={() => setAddressChoice("new")}
                />
                <span className="font-medium">
                  {context.addresses.length === 0 ? "Enter your delivery address" : "Use a new address"}
                </span>
              </label>
              {errors.address ? <p className="text-body-sm text-destructive">{errors.address[0]}</p> : null}

              {addressChoice === "new" ? (
                <NewAddressFields
                  values={newAddress}
                  onChange={(field, value) => setNewAddress((current) => ({ ...current, [field]: value }))}
                  errors={errors}
                />
              ) : null}
            </fieldset>

            <fieldset className="flex flex-col gap-3">
              <legend className="mb-2 font-heading text-heading-3">Delivery date</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {context.deliveryDates.map((date) => (
                  <label
                    key={date}
                    className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-border bg-surface px-4 has-checked:border-primary"
                  >
                    <input
                      type="radio"
                      name="deliveryDate"
                      value={date}
                      checked={deliveryDate === date}
                      onChange={() => setDeliveryDate(date)}
                    />
                    <span className="font-medium">{formatDeliveryDate(date, context.today)}</span>
                  </label>
                ))}
              </div>
              <p className="text-caption text-muted-foreground">
                We deliver Tuesday to Saturday this week. Same-day orders close at{" "}
                {formatClockTime(context.cutoff)} (Abuja time); after that, the next delivery day is the earliest.
              </p>
              {errors.deliveryDate ? (
                <p className="text-body-sm text-destructive">{errors.deliveryDate[0]}</p>
              ) : null}
            </fieldset>

            <TextareaField
              label="Special notes (optional)"
              name="specialNotes"
              rows={3}
              maxLength={SPECIAL_NOTES_MAX}
              value={specialNotes}
              onChange={(event) => setSpecialNotes(event.target.value)}
              hint={`${specialNotes.length}/${SPECIAL_NOTES_MAX} characters`}
              errors={errors.specialNotes}
            />

            <DeliveryFeeNotice />

            <div className="flex flex-wrap gap-3">
              <SubmitButton fullWidth={false} pendingLabel="Checking…">
                Review order
              </SubmitButton>
              <Button type="button" variant="outline" size="lg" onClick={() => setStep("Customer")}>
                Back
              </Button>
            </div>
          </form>
        ) : null}

        {step === "Review" && summary ? (
          <section aria-labelledby="review-heading" className="flex flex-col gap-6">
            <h2 id="review-heading" className="text-heading-2 text-primary">
              Review your order
            </h2>

            <div className="flex flex-col gap-2">
              <h3 className="font-heading text-heading-3">Your order</h3>
              <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
                {summary.lines.map((line) => (
                  <li key={line.productId} className="flex justify-between gap-4 p-3 text-body-sm">
                    <span>
                      <span className="font-medium">{line.name}</span>
                      <span className="block text-muted-foreground">
                        {line.quantity} × {formatNaira(line.unitPrice)}
                      </span>
                    </span>
                    <span className="font-medium">{formatNaira(line.lineTotal)}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <h3 className="font-heading text-heading-3">Delivery</h3>
                <p className="text-body-sm">{formatLongDate(summary.deliveryDate)}</p>
                <p className="text-body-sm">
                  {summary.address.recipientName} · {summary.address.phone}
                </p>
                <p className="text-body-sm text-muted-foreground">
                  {[summary.address.addressLine, summary.address.city, summary.address.state].join(", ")}
                </p>
                {summary.address.additionalInfo ? (
                  <p className="text-body-sm text-muted-foreground">{summary.address.additionalInfo}</p>
                ) : null}
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="font-heading text-heading-3">Notes</h3>
                <p className="text-body-sm text-muted-foreground">{summary.specialNotes ?? "No special notes."}</p>
              </div>
            </div>

            <DeliveryFeeNotice />

            <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
              <h3 className="font-heading text-heading-3">Payment</h3>
              <dl className="flex items-center justify-between text-body-lg font-semibold">
                <dt>Order total</dt>
                <dd>{formatNaira(summary.subtotal)}</dd>
              </dl>
              {/* Paystack payment is implemented in Milestone 10. */}
              <button
                type="button"
                disabled
                aria-describedby="payment-pending"
                className="mt-2 inline-flex h-11 cursor-not-allowed items-center justify-center rounded-md bg-muted px-6 text-button font-semibold text-muted-foreground"
              >
                Pay with Paystack
              </button>
              <p id="payment-pending" className="text-caption text-muted-foreground">
                Online payment is not available yet.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" onClick={() => setStep("Delivery")}>
                Change delivery details
              </Button>
              <Button asChild variant="ghost">
                <Link href="/cart">Edit cart</Link>
              </Button>
            </div>
          </section>
        ) : null}
      </div>

      <aside aria-labelledby="checkout-summary-heading" className="flex h-fit flex-col gap-3 rounded-lg border border-border bg-surface p-5">
        <h2 id="checkout-summary-heading" className="text-heading-3 text-primary">
          Order Summary
        </h2>
        <ul className="flex flex-col gap-2 text-body-sm">
          {cart.items.map((item) => (
            <li key={item.productId} className="flex justify-between gap-3">
              <span>
                {item.quantity} × {item.name}
              </span>
              <span>{item.lineTotal !== null ? formatNaira(item.lineTotal) : "—"}</span>
            </li>
          ))}
        </ul>
        <dl className="flex items-center justify-between border-t border-border pt-3 font-semibold">
          <dt>Subtotal</dt>
          <dd>{formatNaira(cart.subtotal)}</dd>
        </dl>
        <p className="text-caption text-muted-foreground">Delivery fee not included.</p>
      </aside>
    </div>
  );
}

function DeliveryFeeNotice() {
  return (
    <p className="flex gap-3 rounded-md bg-accent-soft px-4 py-3 text-body-sm text-foreground">
      <Truck className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden="true" />
      <span>
        Delivery fee is handled separately by our delivery partner and is not included in the amount
        paid to Samy&apos;s Bakery.
      </span>
    </p>
  );
}

type AddressValues = typeof EMPTY_ADDRESS;

function NewAddressFields({
  values,
  onChange,
  errors,
}: {
  values: AddressValues;
  onChange: (field: keyof AddressValues, value: string) => void;
  errors: Record<string, string[]>;
}) {
  const id = useId();
  const field = (name: keyof AddressValues) => ({
    name,
    value: values[name],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => onChange(name, event.target.value),
    errors: errors[`newAddress.${name}`],
  });

  return (
    <div id={id} className="grid gap-4 rounded-lg border border-dashed border-border p-4 sm:grid-cols-2">
      <FormField label="Recipient's name" autoComplete="name" maxLength={120} {...field("recipientName")} />
      <FormField label="Phone number" type="tel" autoComplete="tel" maxLength={30} {...field("phone")} />
      <div className="sm:col-span-2">
        <FormField label="Street address" autoComplete="street-address" maxLength={300} {...field("addressLine")} />
      </div>
      <FormField label="City" autoComplete="address-level2" maxLength={100} {...field("city")} />
      <FormField label="State" autoComplete="address-level1" maxLength={100} {...field("state")} />
      <div className="sm:col-span-2">
        <FormField
          label="Landmark or extra directions (optional)"
          maxLength={500}
          {...field("additionalInfo")}
        />
      </div>
      <div className="sm:col-span-2">
        <FormField
          label="Save as (optional)"
          placeholder="e.g. Home, Office"
          maxLength={50}
          hint="This address will be saved to your account for next time."
          {...field("label")}
        />
      </div>
    </div>
  );
}
