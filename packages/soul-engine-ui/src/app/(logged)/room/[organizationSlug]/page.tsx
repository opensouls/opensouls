import { fetchLoggedUserBlueprints } from "@/lib/queries/user/blueprintQueries";
import { Editor } from "./Editor";
import { getPageParamsOrRedirect } from "@/lib/params";
import z from "zod";
import { SoulOpts } from "@opensouls/soul";

export default async function Page({ params, searchParams }: {
  params: { organizationSlug: string },
  searchParams: { souls: string[], contexts: string[] }
}) {

  getPageParamsOrRedirect({ params });
  const blueprints = await fetchLoggedUserBlueprints();

  return (
    <Editor 
      params={params} 
      blueprints={blueprints} 
      souls={parseSoulParams(searchParams.souls)} 
      contexts={parseSoulParams(searchParams.contexts)} 
    />
  );
}

function parseSoulParams(param: string | string[] | undefined): (SoulOpts & { soulId: string })[] {
  if (!param) return [];
  const params = Array.isArray(param) ? param : [param];
  return params.map(p => {
    const [organization, blueprint, soulId] = decodeURIComponent(p).split('.');
    return { organization, blueprint, soulId };
  });
}
