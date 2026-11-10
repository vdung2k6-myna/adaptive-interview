import { NextRequest } from "next/server";

import { proxyToBackend } from "@/lib/backend-proxy";

/**
 * Audio Proxy Route Handler
 *
 * The backend serves `/audio/*` behind the same Bearer as `/api`, and neither a
 * browser fetch nor an `<audio>` element can attach that header. This route
 * forwards the request server-side with the credential, so a music track and an
 * interview recording are readable from the same-origin path the page is given.
 *
 * `HEAD` and `Range` matter here: a media element asks for a byte range and
 * resumes a seek, so the shared proxy passes both through and returns the
 * backend's 206 and content-range headers unchanged.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyToBackend(request, path, "audio");
}

export async function HEAD(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyToBackend(request, path, "audio");
}
