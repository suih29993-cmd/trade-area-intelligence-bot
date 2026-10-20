const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'geolocation=(), camera=(), microphone=()',
  'Referrer-Policy': 'no-referrer',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff'
};

export function onRequestPost() {
  return new Response(JSON.stringify({
    ok: false,
    error: 'live_disabled',
    message: 'Live AI is disabled. The browser uses the local rule engine.'
  }), { status: 409, headers });
}

export function onRequest() {
  return new Response(JSON.stringify({ ok: false, error: 'method_not_allowed' }), {
    status: 405,
    headers
  });
}
