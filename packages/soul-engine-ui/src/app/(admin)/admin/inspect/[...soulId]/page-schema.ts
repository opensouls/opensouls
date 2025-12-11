import { redirect } from "next/navigation";
import z from "zod";

export const pageSchema = z
  .object({
    params: z.object({
      soulId: z.array(z.string()),
    }),
  })
  .refine((data) => {
    const parts = data.params.soulId;
    if (parts.length !== 3) {
      return false;
    }

    if (parts.some((part) => part.trim().length === 0)) {
      return false;
    }

    return true;
  })
  .transform((data) => {
    return { soulId: data.params.soulId.join(".") };
  });

export function getPageParamsOrRedirect(props: unknown) {
  const params = pageSchema.safeParse(props);
  if (!params.success) {
    redirect("/404");
  }

  return params.data;
}
