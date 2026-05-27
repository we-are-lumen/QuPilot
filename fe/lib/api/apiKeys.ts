import { apiClient } from './client';
import type {
  IGenerateApiKeyResponse,
  IGetApiKeyResponse,
  IRevokeApiKeyResponse,
} from '@/lib/types/apiKeys';

/**
 * POST /me/api-key
 *
 * Generates a new API Key for the authenticated user.
 */
export async function generateApiKey(label: string): Promise<IGenerateApiKeyResponse> {
  const response = await apiClient.post<IGenerateApiKeyResponse>('/me/api-key', { label });
  return response.data;
}

/**
 * GET /me/api-key
 *
 * Fetches the active API Key details for the authenticated user.
 */
export async function getApiKey(): Promise<IGetApiKeyResponse> {
  const response = await apiClient.get<IGetApiKeyResponse>('/me/api-key');
  return response.data;
}

/**
 * DELETE /me/api-key
 *
 * Revokes the active API Key for the authenticated user.
 */
export async function revokeApiKey(): Promise<IRevokeApiKeyResponse> {
  const response = await apiClient.delete<IRevokeApiKeyResponse>('/me/api-key');
  return response.data;
}
