import { z } from "zod";
import { isSlugValid } from "./slug";

export const slugSchema = z
  .string()
  .min(3)
  .max(40)
  .refine((s) => isSlugValid(s.toLowerCase()), {
    message:
      "Slug must be 3-40 lowercase letters/numbers separated by single dashes, and not reserved",
  })
  .transform((s) => s.toLowerCase());

export const viewPolicySchema = z.enum(["public", "pin", "owner"]);
export const editPolicySchema = z.enum(["owner", "pin", "anyone"]);

export const createPageSchema = z
  .object({
    slug: slugSchema,
    title: z.string().max(80).optional().default("Untitled page"),
    description: z.string().max(500).optional().default(""),
    viewPolicy: viewPolicySchema.optional().default("public"),
    editPolicy: editPolicySchema.optional().default("anyone"),
    /** Plaintext PIN (4-128 chars) when using pin policies. */
    secret: z.string().min(4).max(128).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.viewPolicy === "owner" && v.editPolicy !== "owner") {
      ctx.addIssue({
        code: "custom",
        message: "view=owner requires edit=owner",
      });
    }
    if (
      v.viewPolicy === "pin" &&
      !(v.editPolicy === "pin" || v.editPolicy === "owner")
    ) {
      ctx.addIssue({
        code: "custom",
        message: "view=pin requires edit to be pin or owner",
      });
    }
    if (
      (v.viewPolicy === "pin" || v.editPolicy === "pin") &&
      v.secret === undefined
    ) {
      ctx.addIssue({
        code: "custom",
        message: "PIN policies require a secret",
      });
    }
  });

export const updatePageSchema = z.object({
  title: z.string().min(1).max(80).optional(),
  description: z.string().max(500).optional(),
  slug: slugSchema.optional(),
  viewPolicy: viewPolicySchema.optional(),
  editPolicy: editPolicySchema.optional(),
  /** Set/change PIN. Pair with policies. */
  secret: z.string().min(4).max(128).nullable().optional(),
});

export const unlockSchema = z.object({
  secret: z.string().min(1).max(128),
});

export const infoHashSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{40}$/, "infoHash must be 40 hex chars")
  .transform((s) => s.toLowerCase());

export const createFileSchema = z
  .object({
    kind: z.enum(["p2p", "inline"]),
    name: z.string().min(1).max(255),
    size: z.number().int().min(0).max(20 * 1024 * 1024 * 1024),
    mime: z.string().max(127).optional().default("application/octet-stream"),
    infoHash: z.string().optional(),
    magnetUri: z.string().max(4096).optional(),
    content: z.string().max(256 * 1024).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "p2p") {
      if (v.infoHash !== undefined) {
        const r = infoHashSchema.safeParse(v.infoHash);
        if (!r.success) {
          ctx.addIssue({
            code: "custom",
            message: "infoHash must be 40 hex chars",
          });
        }
      }
      if (v.content !== undefined) {
        ctx.addIssue({ code: "custom", message: "p2p files cannot carry content" });
      }
    } else {
      if (v.content === undefined) {
        ctx.addIssue({ code: "custom", message: "inline files require content" });
      }
      if (v.infoHash !== undefined || v.magnetUri !== undefined) {
        ctx.addIssue({
          code: "custom",
          message: "inline files cannot carry infoHash/magnetUri",
        });
      }
    }
  });

export const updateFileSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  position: z.number().int().min(0).optional(),
  content: z.string().max(256 * 1024).optional(),
  revision: z.number().int().min(1).optional(),
});

export type CreatePageInput = z.infer<typeof createPageSchema>;
