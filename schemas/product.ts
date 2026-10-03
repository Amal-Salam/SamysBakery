import { z } from "zod";

export const uuidSchema = z.uuid("Invalid identifier.");

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be at most ${max} characters.`)
    .default("");

const slugField = z
  .string()
  .trim()
  .toLowerCase()
  .max(140, "Slug is too long.")
  .regex(/^([a-z0-9]+(-[a-z0-9]+)*)?$/, "Use lowercase letters, numbers and single hyphens.")
  .default("");

// Empty string from a <select> means "no category".
const categoryField = z
  .union([z.literal(""), uuidSchema])
  .transform((value) => (value === "" ? null : value));

export const productInputSchema = z.object({
  name: z.string().trim().min(1, "Enter a product name.").max(120, "Name is too long."),
  slug: slugField,
  categoryId: categoryField,
  description: optionalText(2000, "Description"),
  ingredients: optionalText(2000, "Ingredients"),
});

export const productImageMetaSchema = z.object({
  altText: z
    .string()
    .trim()
    .min(1, "Describe the photo for people using screen readers.")
    .max(300, "Description is too long."),
});

export const moveDirectionSchema = z.enum(["up", "down"]);

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1, "Enter a category name.").max(60, "Name is too long."),
});

export type ProductInput = z.infer<typeof productInputSchema>;
