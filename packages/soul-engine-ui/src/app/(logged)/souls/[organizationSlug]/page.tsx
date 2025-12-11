import { fetchLoggedUserBlueprints } from "@/lib/queries/user/blueprintQueries";
import { DotsHorizontalIcon, ExclamationTriangleIcon, LockClosedIcon } from "@radix-ui/react-icons";
import Link from "next/link";
import { redirect } from "next/navigation";
import z from "zod";
import BlueprintDropdownMenu from "./BlueprintDropdownMenu";
import Breadcumbs from "./Breadcrumbs";
import ScrollableBody from "./ScrollableBody";

export default async function Page(params: unknown) {
  const { organizationSlug } = getPageParamsOrRedirect(params);
  const blueprints = await fetchLoggedUserBlueprints();

  return (
    <>
      <Breadcumbs>
        <span className="text-zinc-300">Blueprints</span>
      </Breadcumbs>

      <ScrollableBody>
        <div className="pb-40 max-w-screen-sm">
          <ul className="pt-2">
            {blueprints.length === 0 ? (
              <li className="text-xs text-slate-400">No blueprints yet.</li>
            ) : (
              blueprints.map((blueprint, index) => (
                <li key={index} className="group h-6 font-OS_mono_medium text-xs text-zinc-400 flex justify-between items-center">
                  <div className="h-full flex-grow flex items-center">
                    <Link href={`/souls/${organizationSlug}/${blueprint.slug}`} className="hover:underline">
                      {blueprint.slug}
                    </Link>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="opacity-50 text-right group-hover:opacity-65">
                      {blueprint.enforce_jwt ? (
                        <div className="cursor-default flex items-center gap-2" title="A JWT is required to access souls created from this blueprint">
                          <span>JWT required</span>
                          <LockClosedIcon className="w-4 h-4 text-green-400" />
                        </div>
                      ) : (
                        <div
                          className="cursor-default flex items-center gap-2"
                          title="Souls created from this blueprint will be accessible to anyone without authentication"
                        >
                          <span>Unsecured</span>
                          <ExclamationTriangleIcon className="w-4 h-4 text-red-400" />
                        </div>
                      )}
                    </span>

                    <BlueprintDropdownMenu blueprint={blueprint}>
                      <div className="w-6 h-6 flex items-center justify-center rounded hover:bg-zinc-700">
                        <DotsHorizontalIcon className="w-4 h-4" />
                      </div>
                    </BlueprintDropdownMenu>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </ScrollableBody>
    </>
  );
}

function getPageParamsOrRedirect(props: unknown) {
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
