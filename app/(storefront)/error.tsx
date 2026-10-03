"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";

export default function StorefrontError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  // Never surface raw error details to customers.
  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      <ErrorState
        title="Something went wrong."
        description="Please try again in a moment."
        action={<Button onClick={() => retry()}>Try again</Button>}
      />
    </div>
  );
}
