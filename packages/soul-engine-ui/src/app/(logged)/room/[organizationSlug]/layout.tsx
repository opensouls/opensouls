import LoggedUserDropdownMenu from "@/components/LoggedUserDropdownMenu";
import { fetchLoggedUserOrganization } from "@/lib/queries/user/loggedUserQueries";
import Image from "next/image";
import { redirect } from "next/navigation";
import "./layout.css";

export default async function Layout({ children, params }: { children: React.ReactNode; params: { organizationSlug: string } }) {
  const userOrganization = await fetchLoggedUserOrganization();
  if (!userOrganization) {
    redirect("/404");
  }

  if (userOrganization.slug !== params.organizationSlug) {
    redirect(`/room/${userOrganization.slug}`);
  }

  return children;
}
