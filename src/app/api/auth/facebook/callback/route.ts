import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const FB_OAUTH_STATE_COOKIE = "fb_oauth_state";
export const FB_PAGES_COOKIE = "fb_pending_pages";
const FB_GRAPH_VERSION = "v22.0";
const GRAPH_BASE = `https://graph.facebook.com/${FB_GRAPH_VERSION}`;

export type FacebookPage = {
  id: string;
  name: string;
  access_token: string;
  category?: string;
};

function getSessionSecret() {
  return new TextEncoder().encode(
    process.env.SESSION_SECRET ??
      "development-session-secret-change-before-deploying",
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");
  const error = searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  if (error) {
    return redirect(
      `/dashboard?fb_error=${encodeURIComponent(searchParams.get("error_description") ?? "Facebook authorization was denied.")}`,
    );
  }

  if (!code || !stateParam) {
    return redirect(`/dashboard?fb_error=Missing+code+or+state.`);
  }

  const cookieStore = await cookies();
  const storedState = cookieStore.get(FB_OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(FB_OAUTH_STATE_COOKIE);

  if (!storedState || storedState !== stateParam) {
    return redirect(`/dashboard?fb_error=Invalid+OAuth+state.+Please+try+again.`);
  }

  let networkId: string;
  try {
    const { payload } = await jwtVerify(storedState, getSessionSecret());
    networkId = payload.networkId as string;
  } catch {
    return redirect(`/dashboard?fb_error=Expired+or+invalid+state.+Please+try+again.`);
  }

  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;

  if (!appId || !appSecret) {
    return redirect(`/dashboard?fb_error=Facebook+app+credentials+not+configured.`);
  }

  const redirectUri = `${appUrl}/api/auth/facebook/callback`;

  // Exchange code for short-lived user token.
  const tokenRes = await fetch(
    `${GRAPH_BASE}/oauth/access_token?` +
      new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        redirect_uri: redirectUri,
        code,
      }),
  );
  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    error?: { message: string };
  };

  if (!tokenData.access_token) {
    const msg = tokenData.error?.message ?? "Failed to get access token.";
    return redirect(`/dashboard?fb_error=${encodeURIComponent(msg)}`);
  }

  // Exchange short-lived token for a long-lived user token (~60 days).
  const extendRes = await fetch(
    `${GRAPH_BASE}/oauth/access_token?` +
      new URLSearchParams({
        grant_type: "fb_exchange_token",
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: tokenData.access_token,
      }),
  );
  const extendData = (await extendRes.json()) as {
    access_token?: string;
    error?: { message: string };
  };

  const longLivedToken = extendData.access_token ?? tokenData.access_token;

  // Fetch all pages the user manages.
  const pagesRes = await fetch(
    `${GRAPH_BASE}/me/accounts?fields=id,name,access_token,category&access_token=${longLivedToken}`,
  );
  const pagesData = (await pagesRes.json()) as {
    data?: FacebookPage[];
    error?: { message: string };
  };

  if (!pagesData.data || pagesData.data.length === 0) {
    return redirect(
      `/dashboard?fb_error=${encodeURIComponent("No Facebook pages found. Make sure you manage at least one page.")}`,
    );
  }

  // Store pages in an encrypted cookie so the picker page can read them.
  // Page access tokens are included — keep this cookie httpOnly and short-lived.
  const pagesPayload = JSON.stringify({ networkId, pages: pagesData.data });
  const encoded = Buffer.from(pagesPayload).toString("base64");

  cookieStore.set(FB_PAGES_COOKIE, encoded, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 300, // 5 minutes to complete page selection
    path: "/",
  });

  redirect(`/dashboard/connect-facebook?networkId=${networkId}`);
}
