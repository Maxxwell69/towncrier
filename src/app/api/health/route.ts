export async function GET() {
  return Response.json({
    ok: true,
    service: "towncrier",
    build: "content-hub",
    timestamp: new Date().toISOString(),
  });
}
