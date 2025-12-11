"use server";
import { redirect } from "next/navigation";
import { NextPage } from "next";

const AuthPage: NextPage = async () => {
  // Local-only mode: no auth screen needed.
  redirect("/");
};

export default AuthPage;
