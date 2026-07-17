import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "../../../lib/auth";
import { saveTabs } from "../../../lib/db";

export async function POST(request) {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!verifySessionToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!Array.isArray(body?.tabs)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    await saveTabs(body.tabs);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("sync failed", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
