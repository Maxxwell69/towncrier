import { SignJWT } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";

const FB_OAUTH_STATE_COOKIE = "fb_oauth_state";
const FB_GRAPH_VERSION = "v22.0";

function getSessionSecret() {
  return new TextEncoder().encode(
    process.env.SESSION_SECRET ??
      "development-session-secret-change-before-deploying",
  );
}

export async function GET(request: Request) {
  const user = await requireUser();

  const { searchParams } = new URL(request.url);
  const networkId = searchParams.get("networkId");

  if (!networkId) {
    return Response.json({ error: "networkId is required" }, { status: 400 });
  }

  const appId = process.env.FACEBOOK_APP_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!appId || !appUrl) {
    return Response.json(
      { error: "FACEBOOK_APP_ID and NEXT_PUBLIC_APP_URL must be set." },
      { status: 500 },
    );
  }

  // Sign a state token containing networkId + userId to prevent CSRF.
  const state = await new SignJWT({ networkId, userId: user.id })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(getSessionSecret());

  const cookieStore = await cookies();
  cookieStore.set(FB_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });

  const redirectUri = `${appUrl}/api/auth/facebook/callback`;
  const scope = "pages_manage_posts,pages_read_engagement";

  const authUrl = new URL(
    `https://www.facebook.com/${FB_GRAPH_VERSION}/dialog/oauth`,
  );
  authUrl.searchParams.set("client_id", appId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", scope);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("response_type", "code");

  redirect(authUrl.toString());
}
