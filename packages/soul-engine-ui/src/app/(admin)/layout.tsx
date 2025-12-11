"use server";

import { ReactElement } from "react";
import { assertAdminUser } from "../../lib/queries/admin/adminUserQueries";

export default async function Layout({ children }: { children: ReactElement }) {
  assertAdminUser();

  return children;
}
