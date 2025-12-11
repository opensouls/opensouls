import { fetchLoggedUserOrganization } from "@/lib/queries/user/loggedUserQueries";
import { redirect } from "next/navigation";
import { getPageParamsOrRedirect } from "@/lib/params";
import { Home } from "./[organizationSlug]/Home";

export default async function Page(params: unknown) {
  const userOrganization = await fetchLoggedUserOrganization();
  
  console.log("userOrganization", userOrganization);
  if (!userOrganization) {
    redirect("/404");
  }
  
  const typedParams = getPageParamsOrRedirect(params);
  console.log("typedParams", typedParams);
  
  // Check if the organizationSlug from the URL matches the userOrganization.slug
  if (typedParams.organizationSlug !== userOrganization.slug) {
    redirect("/404");
  }

  return <Home params={typedParams} />;
}


