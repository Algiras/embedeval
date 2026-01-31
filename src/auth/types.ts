/**
 * Auth Types - Multi-provider authentication types
 */

export type ProviderName = 'gemini' | 'openai' | 'openrouter' | 'anthropic' | 'ollama';

export interface Credential {
  provider: ProviderName;
  apiKey: string;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  refreshToken?: string;
  metadata?: {
    email?: string;
    name?: string;
    plan?: string;
  };
}

export interface CredentialStore {
  get(provider: ProviderName): Promise<Credential | null>;
  set(credential: Credential): Promise<void>;
  delete(provider: ProviderName): Promise<void>;
  list(): Promise<Credential[]>;
  clear(): Promise<void>;
}

export interface AuthFlow {
  name: string;
  provider: ProviderName;
  authenticate(): Promise<Credential>;
}

export interface ProviderConfig {
  name: ProviderName;
  displayName: string;
  authUrl?: string;
  tokenUrl?: string;
  docsUrl: string;
  envVar: string;
  supportsOAuth: boolean;
  supportsDeviceFlow: boolean;
}

export const PROVIDERS: Record<ProviderName, ProviderConfig> = {
  gemini: {
    name: 'gemini',
    displayName: 'Google Gemini',
    docsUrl: 'https://aistudio.google.com/app/apikey',
    envVar: 'GEMINI_API_KEY',
    supportsOAuth: false,
    supportsDeviceFlow: false,
  },
  openai: {
    name: 'openai',
    displayName: 'OpenAI',
    docsUrl: 'https://platform.openai.com/api-keys',
    envVar: 'OPENAI_API_KEY',
    supportsOAuth: false,
    supportsDeviceFlow: false,
  },
  openrouter: {
    name: 'openrouter',
    displayName: 'OpenRouter',
    authUrl: 'https://openrouter.ai/auth',
    tokenUrl: 'https://openrouter.ai/api/v1/auth/keys',
    docsUrl: 'https://openrouter.ai/keys',
    envVar: 'OPENROUTER_API_KEY',
    supportsOAuth: true,
    supportsDeviceFlow: false,
  },
  anthropic: {
    name: 'anthropic',
    displayName: 'Anthropic',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    envVar: 'ANTHROPIC_API_KEY',
    supportsOAuth: false,
    supportsDeviceFlow: false,
  },
  ollama: {
    name: 'ollama',
    displayName: 'Ollama (Local)',
    docsUrl: 'https://ollama.ai',
    envVar: 'OLLAMA_HOST',
    supportsOAuth: false,
    supportsDeviceFlow: false,
  },
};
