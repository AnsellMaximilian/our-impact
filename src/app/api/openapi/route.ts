import { createDeveloperOpenApiDocument } from "@/lib/developer/openapi";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return Response.json(createDeveloperOpenApiDocument(origin), {
    headers: {
      "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
      "content-disposition": 'inline; filename="our-impact-openapi.json"',
    },
  });
}
