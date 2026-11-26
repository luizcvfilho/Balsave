import { simulatorRequest } from "../../../data/session";

const headers = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") {
    return new Response(null, { status: 415, headers });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return new Response(null, { status: 422, headers });
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return new Response(null, { status: 422, headers });
  }

  const response = await simulatorRequest(payload);
  if (!response?.ok) return new Response(null, { status: response?.status ?? 503, headers });
  return new Response(response.body, { headers: { ...headers, "Content-Type": "application/json" } });
}
