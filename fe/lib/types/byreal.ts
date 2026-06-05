export interface IByrealToken {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  logo_uri: string;
  price_usd: number;
  volume_24h_usd: number;
}

export interface IByrealTokensResponse {
  tokens: IByrealToken[];
  total: number;
}
