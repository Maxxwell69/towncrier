export async function GET() {
  return Response.json({
    ok: true,
    service: "towncrier",
    timestamp: new Date().toISOString(),
  });
}
