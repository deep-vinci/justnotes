import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "../../../lib/auth";
import { loadTabs } from "../../../lib/db";

export async function GET() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!verifySessionToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const tabs = await loadTabs();
    return NextResponse.json({ tabs });
  } catch (err) {
    console.error("load failed", err);
    return NextResponse.json({ error: "Load failed" }, { status: 500 });
  }
}
