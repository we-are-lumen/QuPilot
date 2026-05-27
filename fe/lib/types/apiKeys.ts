export interface IApiKey {
  uuid: string;
  key_prefix: string;
  label: string;
  created_at: string;
  last_used_at?: string | null;
}

export interface IGenerateApiKeyResponse {
  plaintext: string;
  api_key: IApiKey;
}

export interface IGetApiKeyResponse {
  api_key: IApiKey | null;
}

export interface IRevokeApiKeyResponse {
  revoked: boolean;
}
