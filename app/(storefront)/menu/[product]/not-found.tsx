import Link from "next/link";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";

export default function ProductNotFound() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      <EmptyState
        title="This product isn't on this week's menu."
        description="Our menu changes every week. Have a look at what's fresh now."
        action={
          <Button asChild>
            <Link href="/menu">View This Week&apos;s Menu</Link>
          </Button>
        }
      />
    </div>
  );
}
