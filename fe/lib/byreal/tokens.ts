import { z } from "zod";
import type { IByrealTokensResponse } from "@/lib/types/byreal";

const numberLike = z.union([z.string(), z.number()]).transform((value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
});

const byrealTokenRecordSchema = z.object({
  address: z.string().trim().min(32).max(64),
  symbol: z.string().trim().min(1),
  name: z.string().trim().min(1),
  decimals: z.coerce.number().int().nonnegative(),
  logoURI: z.url().catch(""),
  price: numberLike.catch(0),
  volumeUsd24h: numberLike.catch(0),
  status: z.coerce.number().int().catch(1),
});

const byrealTokenListResponseSchema = z.object({
  result: z.object({
    data: z.object({
      total: z.coerce.number().int().nonnegative().catch(0),
      records: z.array(byrealTokenRecordSchema).catch([]),
    }),
  }),
});

export const parseByrealTokenListResponse = (payload: unknown): IByrealTokensResponse => {
  const parsed = byrealTokenListResponseSchema.parse(payload);

  const tokens = parsed.result.data.records
    .filter((token) => token.status === 1)
    .map((token) => ({
      mint: token.address,
      symbol: token.symbol,
      name: token.name,
      decimals: token.decimals,
      logo_uri: token.logoURI,
      price_usd: token.price,
      volume_24h_usd: token.volumeUsd24h,
    }));

  return {
    tokens,
    total: parsed.result.data.total,
  };
};
