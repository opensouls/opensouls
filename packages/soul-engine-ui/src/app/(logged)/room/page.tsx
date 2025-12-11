import { fetchLoggedUserOrganization } from "@/lib/queries/user/loggedUserQueries";
import { redirect } from "next/navigation";

export default async function Page() {
  const userOrganization = await fetchLoggedUserOrganization();
  if (!userOrganization) {
    redirect("/404");
  }

  redirect(`/room/${userOrganization.slug}`);

  return <></>;
}
