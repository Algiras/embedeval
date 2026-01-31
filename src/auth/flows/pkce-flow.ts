/**
 * OAuth PKCE Flow - Secure browser-based authentication
 * 
 * Implements OAuth 2.0 with PKCE (Proof Key for Code Exchange)
 * for providers that support it (e.g., OpenRouter)
 */

import * as crypto from 'crypto';
import * as http from 'http';
import * as url from 'url';
import { Credential, ProviderName, PROVIDERS } from '../types.js';
import { logger } from '../../utils/logger.js';

interface PKCEConfig {
  provider: ProviderName;
  authUrl: string;
  tokenUrl: string;
  clientId?: string;
  scopes?: string[];
  callbackPort?: number;
}

interface TokenResponse {
  key?: string;
  api_key?: string;
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

/**
 * Generate PKCE code verifier and challenge
 */
function generatePKCE(): { verifier: string; challenge: string } {
  // Generate 43-128 char random string for verifier
  const verifier = crypto.randomBytes(32).toString('base64url');
  
  // SHA256 hash of verifier, base64url encoded
  const challenge = crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');

  return { verifier, challenge };
}

/**
 * Find an available port for the callback server
 */
async function findAvailablePort(startPort: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.listen(startPort, () => {
      const address = server.address() as { port: number };
      server.close(() => resolve(address.port));
    });
    server.on('error', () => {
      // Port in use, try next
      findAvailablePort(startPort + 1).then(resolve).catch(reject);
    });
  });
}

/**
 * Start temporary callback server to receive OAuth code
 */
function startCallbackServer(port: number): Promise<{ code: string; state: string }> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error('Authentication timed out after 5 minutes'));
    }, 5 * 60 * 1000);

    const server = http.createServer((req, res) => {
      const reqUrl = url.parse(req.url || '', true);
      
      if (reqUrl.pathname === '/callback') {
        const code = reqUrl.query.code as string;
        const state = reqUrl.query.state as string;
        const error = reqUrl.query.error as string;

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: system-ui; text-align: center; padding: 50px;">
                <h1>❌ Authentication Failed</h1>
                <p>${error}: ${reqUrl.query.error_description || 'Unknown error'}</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `);
          clearTimeout(timeout);
          server.close();
          reject(new Error(`OAuth error: ${error}`));
          return;
        }

        if (code) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: system-ui; text-align: center; padding: 50px;">
                <h1>✅ Authentication Successful</h1>
                <p>You can close this window and return to the terminal.</p>
                <script>window.close();</script>
              </body>
            </html>
          `);
          clearTimeout(timeout);
          server.close();
          resolve({ code, state });
          return;
        }
      }

      res.writeHead(404);
      res.end('Not found');
    });

    server.listen(port, () => {
      logger.debug(`Callback server listening on port ${port}`);
    });
  });
}

/**
 * Exchange authorization code for tokens
 */
async function exchangeCodeForToken(
  tokenUrl: string,
  code: string,
  codeVerifier: string,
  redirectUri: string,
  clientId?: string
): Promise<TokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    code_verifier: codeVerifier,
    redirect_uri: redirectUri,
  });

  if (clientId) {
    params.set('client_id', clientId);
  }

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const data = await response.json() as TokenResponse;
  
  if (!response.ok) {
    throw new Error(data.error_description || data.error || 'Token exchange failed');
  }

  return data;
}

/**
 * Open URL in default browser
 */
async function openBrowser(url: string): Promise<void> {
  const open = await import('open');
  await open.default(url);
}

/**
 * Run OAuth PKCE flow
 */
export async function runPKCEFlow(config: PKCEConfig): Promise<Credential> {
  const port = config.callbackPort || await findAvailablePort(3456);
  const redirectUri = `http://localhost:${port}/callback`;
  const state = crypto.randomBytes(16).toString('hex');
  const { verifier, challenge } = generatePKCE();

  // Build authorization URL
  const authParams = new URLSearchParams({
    response_type: 'code',
    redirect_uri: redirectUri,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });

  if (config.clientId) {
    authParams.set('client_id', config.clientId);
  }

  if (config.scopes) {
    authParams.set('scope', config.scopes.join(' '));
  }

  const authUrl = `${config.authUrl}?${authParams.toString()}`;

  // Start callback server
  const serverPromise = startCallbackServer(port);

  // Open browser
  logger.info('Opening browser for authentication...');
  console.log('\n🔐 Opening browser for authentication...');
  console.log(`   If browser doesn't open, visit: ${authUrl}\n`);

  await openBrowser(authUrl);

  // Wait for callback
  console.log('⏳ Waiting for authentication...');
  const { code, state: returnedState } = await serverPromise;

  // Verify state
  if (returnedState !== state) {
    throw new Error('State mismatch - possible CSRF attack');
  }

  // Exchange code for token
  console.log('🔄 Exchanging code for token...');
  const tokens = await exchangeCodeForToken(
    config.tokenUrl,
    code,
    verifier,
    redirectUri,
    config.clientId
  );

  // Extract API key from response (providers use different fields)
  const apiKey = tokens.key || tokens.api_key || tokens.access_token;
  if (!apiKey) {
    throw new Error('No API key in token response');
  }

  const now = new Date().toISOString();
  const credential: Credential = {
    provider: config.provider,
    apiKey,
    createdAt: now,
    updatedAt: now,
  };

  if (tokens.refresh_token) {
    credential.refreshToken = tokens.refresh_token;
  }

  if (tokens.expires_in) {
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    credential.expiresAt = expiresAt.toISOString();
  }

  return credential;
}

/**
 * Refresh OAuth token using refresh token
 */
export async function refreshOAuthToken(
  provider: ProviderName,
  refreshToken: string
): Promise<Credential> {
  const config = PROVIDERS[provider];
  
  if (!config.tokenUrl) {
    throw new Error(`Provider ${provider} does not support token refresh`);
  }

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const data = await response.json() as TokenResponse;

  if (!response.ok) {
    throw new Error(data.error_description || data.error || 'Token refresh failed');
  }

  const apiKey = data.key || data.api_key || data.access_token;
  if (!apiKey) {
    throw new Error('No API key in refresh response');
  }

  const now = new Date().toISOString();
  const credential: Credential = {
    provider,
    apiKey,
    createdAt: now,
    updatedAt: now,
  };

  // Update refresh token if a new one was provided
  if (data.refresh_token) {
    credential.refreshToken = data.refresh_token;
  } else {
    credential.refreshToken = refreshToken;
  }

  if (data.expires_in) {
    const expiresAt = new Date(Date.now() + data.expires_in * 1000);
    credential.expiresAt = expiresAt.toISOString();
  }

  return credential;
}

/**
 * OpenRouter-specific PKCE flow
 */
export async function openRouterPKCEFlow(): Promise<Credential> {
  const config = PROVIDERS.openrouter;
  
  if (!config.authUrl || !config.tokenUrl) {
    throw new Error('OpenRouter OAuth endpoints not configured');
  }

  return runPKCEFlow({
    provider: 'openrouter',
    authUrl: config.authUrl,
    tokenUrl: config.tokenUrl,
    // OpenRouter doesn't require client_id for PKCE
  });
}
