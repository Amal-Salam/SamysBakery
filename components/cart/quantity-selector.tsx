"use client";

import { Minus, Plus } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";

/** − n + control. Bounds are for convenience only; the server re-validates. */
export function QuantitySelector({
  name = "quantity",
  max,
  defaultValue = 1,
  disabled = false,
  label = "Quantity",
}: {
  name?: string;
  max: number;
  defaultValue?: number;
  disabled?: boolean;
  label?: string;
}) {
  const id = useId();
  const upper = Math.max(1, max);
  const [value, setValue] = useState(Math.min(Math.max(1, defaultValue), upper));
  const clamp = (next: number) => Math.min(Math.max(1, next), upper);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-body-sm font-medium">
        {label}
      </label>
      <div className="flex w-fit items-center gap-1 rounded-md border border-border bg-surface p-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Decrease quantity"
          disabled={disabled || value <= 1}
          onClick={() => setValue((current) => clamp(current - 1))}
        >
          <Minus aria-hidden="true" />
        </Button>
        <input
          id={id}
          name={name}
          type="number"
          inputMode="numeric"
          min={1}
          max={upper}
          value={value}
          disabled={disabled}
          onChange={(event) => setValue(clamp(Number(event.target.value) || 1))}
          className="h-10 w-14 rounded-md bg-transparent text-center font-medium [appearance:textfield] focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Increase quantity"
          disabled={disabled || value >= upper}
          onClick={() => setValue((current) => clamp(current + 1))}
        >
          <Plus aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
