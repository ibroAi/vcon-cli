import { z } from "zod";
import { KINDS, VCON_API_VERSION, type Kind } from "../constants.js";

const Metadata = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
});

export const SpecBase = z.object({
  apiVersion: z.literal(VCON_API_VERSION),
  kind: z.enum(KINDS),
  metadata: Metadata,
  spec: z.record(z.any()),
});

export type VconSpec = z.infer<typeof SpecBase> & { kind: Kind };

export function validateSpec(raw: unknown) {
  return SpecBase.parse(raw);
}
