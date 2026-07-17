import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionToken, SESSION_COOKIE_NAME } from "../lib/auth";
import { loadTabs } from "../lib/db";
import Editor from "./Editor";

export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!verifySessionToken(token)) redirect("/login");

  const theme = cookieStore.get("theme")?.value === "dark" ? "dark" : "light";

  let tabs = [];
  try {
    tabs = await loadTabs();
  } catch (err) {
    console.error("initial load failed", err);
  }

  return <Editor initialTabs={tabs} initialTheme={theme} />;
}
