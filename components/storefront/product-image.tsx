import Image from "next/image";

import { productImageUrl } from "@/lib/supabase/storage";
import { cn } from "@/lib/utils";

/**
 * Product photo in a consistent frame. Products without a photo get a quiet
 * name panel — never stand-in photography.
 */
export function ProductImage({
  image,
  name,
  sizes,
  priority = false,
  dimmed = false,
  className,
}: {
  image: { path: string; alt: string } | null;
  name: string;
  sizes: string;
  priority?: boolean;
  dimmed?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("relative aspect-[4/3] overflow-hidden rounded-lg bg-surface-muted sm:aspect-[4/5]", className)}>
      {image ? (
        <Image
          src={productImageUrl(image.path)}
          alt={image.alt}
          fill
          sizes={sizes}
          priority={priority}
          className={cn("object-cover transition-transform duration-500", dimmed && "opacity-60 grayscale-[40%]")}
        />
      ) : (
        <div className="flex h-full items-center justify-center p-6 text-center">
          <span className="font-heading text-heading-3 text-text-muted" aria-hidden="true">
            {name}
          </span>
        </div>
      )}
    </div>
  );
}
