import { fetchLoggedUserSoulsBySubroutineId } from "@/lib/queries/user/soulQueries";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { redirect } from "next/navigation";
import z from "zod";
import Breadcumbs from "../Breadcrumbs";
import ScrollableBody from "../ScrollableBody";

type BasicSoulData = { sessionId: string; updatedAt: string | null };

export default async function Page(params: unknown) {
  const { organizationSlug, subroutineId } = getPageParamsOrRedirect(params);
  const { productionSouls, debugSouls } = await fetchLoggedUserSoulsBySubroutineId(subroutineId);

  return (
    <>
      <Breadcumbs>
        <Link className="hover:underline" href={`/souls/${organizationSlug}`}>
          Blueprints
        </Link>
        <span>&gt;</span>
        <span className="text-zinc-300">{subroutineId}</span>
      </Breadcumbs>

      <ScrollableBody>
        <div className="pb-40 max-w-screen-sm">
          <div className="py-4 pb-2 rt-Text font-OS_bold text-zinc-300 text-base">Production souls</div>
          <ul className="pl-4 text-xs text-zinc-400">
            {productionSouls.length === 0 ? (
              <span>No production souls for this blueprint yet.</span>
            ) : (
              productionSouls.map((soul, index) => <Soul key={index} soul={soul} organizationSlug={organizationSlug} subroutineId={subroutineId} />)
            )}
          </ul>

          <div className="pt-8 pb-2 rt-Text font-OS_bold text-zinc-300 text-base">Debug souls</div>
          <ul className="pl-4 text-xs text-zinc-400">
            {debugSouls.length === 0 ? (
              <span>No debug souls for this blueprint yet.</span>
            ) : (
              debugSouls.map((soul, index) => <Soul key={index} soul={soul} organizationSlug={organizationSlug} subroutineId={subroutineId} />)
            )}
          </ul>
        </div>
      </ScrollableBody>
    </>
  );
}

function Soul({ organizationSlug, subroutineId, soul }: { organizationSlug: string; subroutineId: string; soul: BasicSoulData }) {
  return (
    <li className="group font-OS_mono_regular text-xs flex justify-between items-center">
      <Link href={`/souls/${organizationSlug}/${subroutineId}/${soul.sessionId}`} className="inline-block py-1 hover:underline">
        {soul.sessionId}
      </Link>
      {soul.updatedAt && <span className="opacity-50 text-right group-hover:opacity-65"> updated {formatDistanceToNow(new Date(soul.updatedAt))} ago</span>}
    </li>
  );
}

function getPageParamsOrRedirect(props: unknown) {
  const params = z
    .object({
      params: z.object({
        organizationSlug: z.string(),
        subroutineId: z.string(),
      }),
    })
    .transform((data) => data.params)
    .safeParse(props);
  if (!params.success) {
    redirect("/404");
  }

  return params.data;
}
