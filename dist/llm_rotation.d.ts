/**
 * @file LlmManager.ts
 * @version 1.0.0
 * @description A standalone, reusable module for interacting with multiple LLM providers.
 * It features a robust API key rotation system, status tracking, automatic fallback,
 * and high-fidelity support for provider-specific and model-specific parameters.
 *
 * @author Chun
 * @date 2025-07-14
 *
 * @license MIT
 *
 * This module encapsulates the logic for calling various LLM APIs, handling different
 * request/response formats, and managing multiple API keys per provider.
 *
 * ---
 *
 * To use this module, you need to install the required SDKs for the providers you intend to use:
 *
 * npm install @google/genai @huggingface/inference @mistralai/mistralai cohere-ai openai node-fetch
 *
 * ---
 */
interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
}
interface ModelConfiguration {
    id: string;
    name: string;
    free?: boolean;
    provider?: string;
}
interface ApiKeys {
    [provider: string]: string | string[];
}
interface LlmSettings {
    provider: string;
    model: string;
    apiKeys: ApiKeys;
    temperature?: number;
    topP?: number;
    maxTokens?: number;
    siteUrl?: string;
    siteName?: string;
    providerOverride?: string;
}
type ApiKeyStatus = 'untested' | 'working' | 'failed' | 'rate-limited';
type Provider = 'gemini' | 'openrouter' | 'huggingface' | 'mistral' | 'cohere' | 'nvidia' | 'chutes' | 'requesty';
export declare class LlmManager {
    private _apiKeyIndices;
    apiKeyStatus: Record<Provider, ApiKeyStatus[]>;
    private _hfModelProviderMap;
    /**
     * A static property containing detailed model configurations for various providers.
     * Useful for populating UI dropdowns and understanding model capabilities.
     */
    static modelConfigurations: Record<string, ModelConfiguration[]>;
    /**
     * Initializes the LlmManager.
     */
    constructor();
    /**
     * Generates a response from the configured LLM provider. This is the main entry point for the module.
     */
    generateResponse(prompt: Message[], settings: LlmSettings): Promise<string>;
    private _capitalize;
    private _normalizeApiKeys;
    private _getNextApiKey;
    private _markApiKeySuccess;
    private _markApiKeyFailure;
    private _executeApiCall;
    private _callGemini;
    private _callOpenrouter;
    private _callRequesty;
    private _callHuggingface;
    private _callMistral;
    private _callCohere;
    private _callNvidia;
    private _callChutes;
}
export type { Message, ModelConfiguration, ApiKeys, LlmSettings, ApiKeyStatus, Provider };
export default LlmManager;
//# sourceMappingURL=llm_rotation.d.ts.map