import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { BYREAL_API_URL } from "@/config";
import { parseByrealTokenListResponse } from "@/lib/byreal/tokens";

const querySchema = z.object({
  search: z.string().trim().max(64).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(100),
});

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = querySchema.parse({
    search: request.nextUrl.searchParams.get("search") || undefined,
    page: request.nextUrl.searchParams.get("page") || undefined,
    pageSize: request.nextUrl.searchParams.get("pageSize") || undefined,
  });

  const upstreamUrl = new URL("/byreal/api/dex/v2/mint/list", BYREAL_API_URL);
  upstreamUrl.searchParams.set("page", String(query.page));
  upstreamUrl.searchParams.set("pageSize", String(query.pageSize));
  upstreamUrl.searchParams.set("sortField", "volumeUsd24h");
  upstreamUrl.searchParams.set("sort", "desc");
  if (query.search) upstreamUrl.searchParams.set("searchKey", query.search);

  const response = await fetch(upstreamUrl, {
    headers: { Accept: "application/json" },
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: { code: "BYREAL_TOKEN_LIST_FAILED", message: "Failed to fetch Byreal token list." } },
      { status: 502 },
    );
  }

  const payload = await response.json();
  const tokenList = parseByrealTokenListResponse(payload);

  return NextResponse.json(tokenList);
}
