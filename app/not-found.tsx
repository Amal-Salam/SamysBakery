import Link from "next/link";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 sm:px-6">
      <EmptyState
        title="Page not found."
        description="The page you're looking for doesn't exist."
        action={
          <Button asChild>
            <Link href="/">Go to homepage</Link>
          </Button>
        }
      />
    </main>
  );
}
