import test from "node:test";
import assert from "node:assert/strict";
import { parseByrealTokenListResponse } from "../lib/byreal/tokens.ts";

test("parseByrealTokenListResponse normalizes active token records", () => {
  const parsed = parseByrealTokenListResponse({
    retCode: 0,
    retMsg: "",
    result: {
      success: true,
      version: "v2.0.0",
      timestamp: 1780666699400,
      ret_code: 0,
      ret_msg: null,
      data: {
        total: 2,
        pageNum: 1,
        pageSize: 10,
        records: [
          {
            address: "So11111111111111111111111111111111111111112",
            logoURI: "https://example.com/sol.png",
            symbol: "SOL",
            name: "Wrapped SOL",
            decimals: 9,
            price: "66.63",
            programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
            tvl: "1000",
            category: 0,
            priceChange24h: "-0.0488",
            volumeUsd24h: "1047951.18937659411",
            status: 1,
          },
          {
            address: "Inactive111111111111111111111111111111111111",
            logoURI: "",
            symbol: "OLD",
            name: "Inactive Token",
            decimals: 6,
            price: "0",
            programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
            tvl: "0",
            category: 0,
            priceChange24h: "0",
            volumeUsd24h: "0",
            status: 0,
          },
        ],
      },
    },
    retExtInfo: {},
    time: 1780666699401,
  });

  assert.deepEqual(parsed, {
    tokens: [
      {
        mint: "So11111111111111111111111111111111111111112",
        symbol: "SOL",
        name: "Wrapped SOL",
        decimals: 9,
        logo_uri: "https://example.com/sol.png",
        price_usd: 66.63,
        volume_24h_usd: 1047951.18937659411,
      },
    ],
    total: 2,
  });
});
