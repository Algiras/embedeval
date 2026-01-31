/**
 * Tests for token refresh functionality
 */

import { refreshOAuthToken } from '../../src/auth/flows/pkce-flow';

// Mock the global fetch function
global.fetch = jest.fn();

describe('Token Refresh', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('refreshOAuthToken', () => {
    it('should successfully refresh a token', async () => {
      const mockResponse = {
        key: 'new-api-key-123',
        refresh_token: 'new-refresh-token-456',
        expires_in: 3600,
      };

      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await refreshOAuthToken('openrouter', 'old-refresh-token');

      expect(result.apiKey).toBe('new-api-key-123');
      expect(result.refreshToken).toBe('new-refresh-token-456');
      expect(result.expiresAt).toBeDefined();
      expect(result.provider).toBe('openrouter');
    });

    it('should preserve old refresh token if no new one provided', async () => {
      const mockResponse = {
        key: 'new-api-key-123',
        expires_in: 3600,
      };

      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await refreshOAuthToken('openrouter', 'old-refresh-token');

      expect(result.refreshToken).toBe('old-refresh-token');
    });

    it('should throw error on failed refresh', async () => {
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'invalid_grant', error_description: 'Token expired' }),
      } as Response);

      await expect(refreshOAuthToken('openrouter', 'invalid-token')).rejects.toThrow(
        'Token expired'
      );
    });

    it('should throw error if no api key in response', async () => {
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ expires_in: 3600 }),
      } as Response);

      await expect(refreshOAuthToken('openrouter', 'refresh-token')).rejects.toThrow(
        'No API key in refresh response'
      );
    });
  });

  describe('getCredential with auto-refresh', () => {
    it('should return non-expired credential without refresh', async () => {
      // This would need to mock the store module
      // Implementation depends on how you want to mock the credential store
    });

    it('should refresh expired credentials automatically', async () => {
      // This would test the integration between getCredential and refreshOAuthToken
    });
  });
});
