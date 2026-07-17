import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionToken, SESSION_COOKIE_NAME } from "../lib/auth";
import Editor from "./Editor";

export default async function Home() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!verifySessionToken(token)) redirect("/login");

  return <Editor />;
}
