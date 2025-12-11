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
    redirect(`/souls/${userOrganization.slug}`);
  }

  return (
    <div>
      <div className="fixed h-16 overscroll-none overflow-hidden w-full">
        <div className="h-14 flex items-center justify-between">
          <div className="flex justify-between align-middle pl-6 bg-theme-page-background">
            <Image src="/logo_horizontal.svg" width={140} height={24} alt="Logo" />
          </div>
          <div className="pr-4">
            <LoggedUserDropdownMenu organizationSlug={userOrganization.slug} />
          </div>
        </div>
      </div>
      <div className="pt-16 px-6">{children}</div>
    </div>
  );
}
