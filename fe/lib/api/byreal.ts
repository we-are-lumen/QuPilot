import type { IByrealTokensResponse } from "@/lib/types/byreal";

export async function getByrealTokens(params?: { search?: string; pageSize?: number }): Promise<IByrealTokensResponse> {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.set("search", params.search);
  if (params?.pageSize) searchParams.set("pageSize", String(params.pageSize));

  const query = searchParams.toString();
  const response = await fetch(`/api/byreal/tokens${query ? `?${query}` : ""}`);

  if (!response.ok) {
    throw new Error("Failed to load Byreal token list");
  }

  return response.json() as Promise<IByrealTokensResponse>;
}
