import { fetchLoggedUserSoulById } from "@/lib/queries/user/soulQueries";
import Link from "next/link";
import { redirect } from "next/navigation";
import z from "zod";
import Breadcumbs from "../../Breadcrumbs";
import ScrollableBody from "../../ScrollableBody";
import SoulDetails from "./SoulDetails";

export default async function Page(params: unknown) {
  const { organizationSlug, subroutineId, sessionId } = getPageParamsOrRedirect(params);
  const soul = await fetchLoggedUserSoulById(subroutineId, sessionId);
  if (!soul) {
    redirect("/404");
  }

  if (soul.mode === "debug") {
    redirect(`/chats/${organizationSlug}/${subroutineId}/${sessionId}/`);
  }

  return (
    <div>
      <Breadcumbs>
        <Link className="hover:underline" href={`/souls/${organizationSlug}`}>
          Blueprints
        </Link>
        <span>&gt;</span>
        <Link className="hover:underline" href={`/souls/${organizationSlug}/${subroutineId}`}>
          {subroutineId}
        </Link>
        <span>&gt;</span>
        <span className="text-theme-gray-12">{sessionId}</span>
      </Breadcumbs>

      <ScrollableBody>
        <SoulDetails organizationSlug={organizationSlug} subroutineId={subroutineId} sessionId={sessionId} />
      </ScrollableBody>
    </div>
  );
}

function getPageParamsOrRedirect(props: unknown) {
  const params = z
    .object({
      params: z.object({
        organizationSlug: z.string(),
        subroutineId: z.string(),
        sessionId: z.string(),
      }),
    })
    .transform((data) => data.params)
    .safeParse(props);
  if (!params.success) {
    redirect("/404");
  }

  return params.data;
}
