import { NextRequest, NextResponse } from 'next/server';
import { isSelfTarget, requestOriginFromHeaders } from '@/lib/proxy-origin';

/**
 * API Proxy Route Handler
 *
 * This handler intercepts requests from the browser and forwards them to the
 * backend API server, injecting the sensitive NEXT_PUBLIC_API_TOKEN server-side.
 * This prevents the token from being exposed in the browser's network tab.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return handleProxy(request, resolvedParams.path);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return handleProxy(request, resolvedParams.path);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return handleProxy(request, resolvedParams.path);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return handleProxy(request, resolvedParams.path);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return handleProxy(request, resolvedParams.path);
}

async function handleProxy(
  request: NextRequest,
  pathSegments: string[]
) {
  // Use environment variable or fallback to the default backend URL used in rewrites
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
  const authToken = process.env.NEXT_PUBLIC_API_TOKEN;

  // A backend URL naming this app's own origin would make the proxy call
  // itself through the public ingress until the edge times out. Refuse it
  // immediately, naming the variable, instead of forwarding.
  const publicOrigin =
    requestOriginFromHeaders(request.headers, request.nextUrl.protocol) ??
    request.nextUrl.origin;
  if (isSelfTarget(backendUrl, [publicOrigin, request.nextUrl.origin])) {
    console.error(
      `[Proxy] refusing to forward ${request.nextUrl.pathname}: NEXT_PUBLIC_BACKEND_URL names this app's own origin`
    );
    return NextResponse.json(
      {
        error: 'The API proxy is misconfigured.',
        detail:
          "NEXT_PUBLIC_BACKEND_URL names this application's origin. It must name the backend API's origin, for example http://127.0.0.1:4000. Correct it and rebuild: the value is inlined at build time.",
      },
      { status: 502 }
    );
  }

  // Construct the target URL
  const rawPath = pathSegments.join('/');
  const cleanPath = rawPath.startsWith('api/') ? rawPath : `api/${rawPath}`;
  const searchParams = request.nextUrl.search;
  const targetUrl = `${backendUrl}/${cleanPath}${searchParams}`;

  try {
    // Create a clean set of headers to avoid forwarding browser-specific
    // headers (like 'host' or 'origin') that can cause 401/403 errors at the backend.
    const headers = new Headers();

    // Forward only essential headers from the client
    const essentialHeaders = ['content-type', 'accept', 'user-agent'];
    essentialHeaders.forEach(h => {
      const val = request.headers.get(h);
      if (val) headers.set(h, val);
    });

    // Inject the Bearer token server-side
    if (authToken) {
      headers.set('Authorization', `Bearer ${authToken}`);
    }

    // Forward the request to the backend
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: headers,
      body: request.method !== 'GET' ? await request.blob() : undefined,
    });

    // Return the backend response as is
    return new NextResponse(response.body, {
      status: response.status,
      headers: response.headers,
    });
  } catch (error) {
    console.error('Proxy Error:', error);
    return NextResponse.json(
      { error: 'Failed to proxy request to backend API' },
      { status: 502 }
    );
  }
}
