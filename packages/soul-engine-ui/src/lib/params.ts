import z from "zod";
import { redirect } from "next/navigation";

export function getPageParamsOrRedirect(props: unknown) {
    const params = z
        .object({
            params: z.object({
                organizationSlug: z.string(),
            }),
        })
        .transform((data) => data.params)
        .safeParse(props);
    if (!params.success) {
        redirect("/404");
    }

    return params.data;
}
