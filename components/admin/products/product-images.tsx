"use client";

import Image from "next/image";
import { useActionState, useEffect, useRef } from "react";

import {
  addProductImageAction,
  deleteProductImageAction,
  moveProductImageAction,
  updateProductImageAction,
} from "@/actions/admin/products";
import { ConfirmActionDialog } from "@/components/admin/confirm-action-dialog";
import { Button } from "@/components/ui/button";
import {
  FormError,
  FormField,
  FormSuccess,
  SubmitButton,
  fieldErrorsOf,
} from "@/components/ui/form";
import type { LibraryImage } from "@/features/products/queries";
import { productImageUrl } from "@/lib/supabase/storage";

export function ProductImages({
  productId,
  productName,
  images,
}: {
  productId: string;
  productName: string;
  images: LibraryImage[];
}) {
  return (
    <div className="flex flex-col gap-6">
      {images.length === 0 ? (
        <p className="text-body-sm text-muted-foreground">No photos yet.</p>
      ) : (
        <ol className="flex flex-col gap-4">
          {images.map((image, index) => (
            <li
              key={image.id}
              className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 sm:flex-row"
            >
              <Image
                src={productImageUrl(image.storagePath)}
                alt={image.altText}
                width={160}
                height={160}
                sizes="160px"
                className="aspect-square h-auto w-40 shrink-0 rounded-md object-cover"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <p className="text-caption text-muted-foreground">
                  {index === 0 ? "Main photo" : `Photo ${index + 1}`}
                </p>
                <ImageAltForm productId={productId} image={image} />
                <div className="flex flex-wrap gap-2">
                  <form action={moveProductImageAction}>
                    <input type="hidden" name="imageId" value={image.id} />
                    <input type="hidden" name="productId" value={productId} />
                    <input type="hidden" name="direction" value="up" />
                    <Button type="submit" variant="outline" size="sm" disabled={index === 0}>
                      Move earlier
                    </Button>
                  </form>
                  <form action={moveProductImageAction}>
                    <input type="hidden" name="imageId" value={image.id} />
                    <input type="hidden" name="productId" value={productId} />
                    <input type="hidden" name="direction" value="down" />
                    <Button
                      type="submit"
                      variant="outline"
                      size="sm"
                      disabled={index === images.length - 1}
                    >
                      Move later
                    </Button>
                  </form>
                  <ConfirmActionDialog
                    trigger="Remove photo"
                    triggerSize="sm"
                    title="Remove this photo?"
                    description={
                      <p>
                        It will be removed from the Product Library. Weekly menus and past orders
                        that already use it are not affected.
                      </p>
                    }
                    confirmLabel="Remove photo"
                    pendingLabel="Removing…"
                    action={deleteProductImageAction}
                    fields={{ imageId: image.id, productId }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
      <UploadImageForm productId={productId} productName={productName} />
    </div>
  );
}

function ImageAltForm({ productId, image }: { productId: string; image: LibraryImage }) {
  const [state, action] = useActionState(updateProductImageAction, null);
  const errors = fieldErrorsOf(state);
  return (
    <form action={action} className="flex flex-col gap-2" noValidate>
      <input type="hidden" name="imageId" value={image.id} />
      <input type="hidden" name="productId" value={productId} />
      <FormField
        label="Photo description (alt text)"
        name="altText"
        maxLength={300}
        defaultValue={image.altText}
        errors={errors.altText}
      />
      <FormError state={state} />
      <FormSuccess state={state} message="Description saved." />
      <SubmitButton size="sm" variant="outline" fullWidth={false} className="self-start" pendingLabel="Saving…">
        Save description
      </SubmitButton>
    </form>
  );
}

function UploadImageForm({ productId, productName }: { productId: string; productName: string }) {
  const [state, action] = useActionState(addProductImageAction, null);
  const errors = fieldErrorsOf(state);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={action}
      className="flex max-w-xl flex-col gap-4 rounded-lg border border-dashed border-border p-4"
      noValidate
    >
      <p className="font-medium">Add a photo</p>
      <input type="hidden" name="productId" value={productId} />
      <FormError state={state} />
      <FormSuccess state={state} message="Photo uploaded." />
      <FormField
        label="Photo"
        name="photo"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        required
        hint="JPEG, PNG, WebP or AVIF, up to 5 MB."
        errors={errors.photo}
      />
      <FormField
        label="Photo description (alt text)"
        name="altText"
        required
        maxLength={300}
        placeholder={`e.g. ${productName} on a wooden board`}
        hint="Describes the photo for people using screen readers."
        errors={errors.altText}
      />
      <SubmitButton fullWidth={false} className="self-start" pendingLabel="Uploading…">
        Upload photo
      </SubmitButton>
    </form>
  );
}
