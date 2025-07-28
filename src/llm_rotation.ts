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

// Type definitions
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

interface ApiKeyInfo {
    keys: string[];
    currentIndex: number;
    currentKey: string;
}

type ApiCall = (apiKey: string, settings: LlmSettings, prompt: Message[]) => Promise<string>;

export class LlmManager {
    private _apiKeyIndices: Record<Provider, number>;
    public apiKeyStatus: Record<Provider, ApiKeyStatus[]>;
    private _hfModelProviderMap: Record<string, string>;

    /**
     * A static property containing detailed model configurations for various providers.
     * Useful for populating UI dropdowns and understanding model capabilities.
     */
    static modelConfigurations: Record<string, ModelConfiguration[]> = {
        openrouter: [
            { id: "microsoft/mai-ds-r1:free", name: "MAI-DS R1 (Free)", free: true },
            { id: "arliai/qwq-32b-arliai-rpr-v1:free", name: "QWQ 32B RPR", free: true },
            { id: "deepseek/deepseek-chat-v3-0324:free", name: "DeepSeek Chat v3", free: true },
            { id: "deepseek/deepseek-r1:free", name: "DeepSeek R1 (Free)", free: true },
            { id: "deepseek/deepseek-r1-zero:free", name: "DeepSeek R1 Zero (Free)", free: true },
            { id: "deepseek/deepseek-r1-0528:free", name: "DeepSeek R1 0528 (Free)", free: true },
            { id: "tngtech/deepseek-r1t2-chimera:free", name: "DeepSeek R1T2 Chimera (Free)", free: true },
            { id: "tencent/hunyuan-a13b-instruct:free", name: "Hunyuan A13B Instruct (Free)", free: true },
            { id: "rekaai/reka-flash-3:free", name: "Reka Flash 3 (Free)", free: true },
            { id: "moonshotai/moonlight-16b-a3b-instruct:free", name: "Moonlight 16B A3B Instruct (Free)", free: true },
            { id: "cognitivecomputations/dolphin3.0-mistral-24b:free", name: "Dolphin 3.0 Mistral 24B (Free)", free: true },
            { id: "tngtech/deepseek-r1t-chimera:free", name: "DeepSeek R1T Chimera (Free)", free: true },
            { id: "minimax/minimax-m1:extended", name: "MiniMax M1 Extended (Free)", free: true }
        ],
        huggingface: [
            { id: "meta-llama/Llama-3.3-70B-Instruct", name: "Llama 3.3 70B Instruct", provider: "nebius" },
            { id: "deepseek-ai/DeepSeek-V3-0324", name: "DeepSeek V3", provider: "sambanova" },
            { id: "alpindale/WizardLM-2-8x22B", name: "WizardLM 2 8x22B", provider: "novita" },
            { id: "cognitivecomputations/dolphin-2.9.2-mixtral-8x22b", name: "Dolphin 2.9.2 Mixtral 8x22B", provider: "nebius" },
            { id: "HuggingFaceH4/zephyr-7b-beta", name: "Zephyr 7B Beta", provider: "hf-inference" },
            { id: "Sao10K/L3-8B-Stheno-v3.2", name: "L3 8B Stheno v3.2", provider: "novita" },
            { id: "Sao10K/L3-8B-Lunaris-v1", name: "L3 8B Lunaris v1", provider: "novita" }
        ],
        gemini: [
            { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
            { id: "gemini-2.5-pro-preview-05-06", name: "Gemini 2.5 Pro Preview" },
            { id: "gemini-2.5-flash-preview-05-20", name: "Gemini 2.5 Flash Preview 05-20" },
            { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
            { id: "gemini-2.5-flash-lite-preview-06-17", name: "Gemini 2.5 Flash Lite Preview 06-17" },
            { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash" },
            { id: "gemini-2.0-flash-lite", name: "Gemini 2.0 Flash Lite" },
            { id: "gemini-2.0-flash-thinking-exp-01-21", name: "Gemini 2.0 Flash Thinking Exp 01-21" },
            { id: "gemini-exp-1206", name: "Gemini Exp 1206" },
            { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro" },
            { id: "learnlm-2.0-flash-experimental", name: "LearnLM 2.0 Flash Experimental" },
            { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash" }
        ],
        mistral: [
            { id: "mistral-large-latest", name: "Mistral Large" },
            { id: "mistral-medium-latest", name: "Mistral Medium" },
            { id: "mistral-small-latest", name: "Mistral Small" },
            { id: "magistral-medium-latest", name: "Magistral Medium" },
            { id: "magistral-small-latest", name: "Magistral Small" },
            { id: "open-mistral-nemo", name: "Open Mistral Nemo" }
        ],
        cohere: [
            { id: "command-a-03-2025", name: "Command A 03-2025" },
            { id: "command-r7b-12-2024", name: "Command R7B 12-2024" },
            { id: "command-r-plus-08-2024", name: "Command R Plus 08-2024" },
            { id: "command-r-08-2024", name: "Command R 08-2024" },
            { id: "command-nightly", name: "Command Nightly" }
        ],
        chutes: [
            { id: "deepseek-ai/DeepSeek-R1", name: "DeepSeek R1" },
            { id: "deepseek-ai/DeepSeek-R1-0528", name: "DeepSeek R1 0528" },
            { id: "deepseek-ai/DeepSeek-R1-0528-Qwen3-8B", name: "DeepSeek R1 0528 Qwen3 8B" },
            { id: "deepseek-ai/DeepSeek-V3-0324", name: "DeepSeek V3 (0324)" },
            { id: "ArliAI/QwQ-32B-ArliAI-RpR-v1", name: "ArliAI QwQ 32B RPR v1" },
            { id: "microsoft/MAI-DS-R1-FP8", name: "Microsoft MAI-DS R1 FP8" },
            { id: "tngtech/DeepSeek-R1T-Chimera", name: "DeepSeek R1T Chimera" },
            { id: "tngtech/DeepSeek-TNG-R1T2-Chimera", name: "DeepSeek TNG R1T2 Chimera" },
            { id: "tencent/Hunyuan-A13B-Instruct", name: "Hunyuan A13B Instruct" },
            { id: "Qwen/Qwen3-235B-A22B", name: "Qwen3-235B-A22B" },
            { id: "chutesai/Llama-4-Maverick-17B-128E-Instruct-FP8", name: "Llama 4 Maverick 17B 128E Instruct FP8" },
            { id: "MiniMaxAI/MiniMax-M1-80k", name: "MiniMax M1 80k" },
            { id: "mrfakename/mistral-Small-3.1-24B-Instruct-2503-hf", name: "Mistral Small 3.1 24B Instruct 2503 HF" },
            { id: "moonshotai/Kimi-K2-Instruct", name: "Kimi K2 Instruct" }
        ],
        nvidia: [
            { id: "nvidia/llama-3.3-nemotron-super-49b-v1", name: "Llama 3.3 Nemotron Super 49B" },
            { id: "nvidia/llama-3.1-nemotron-ultra-253b-v1", name: "Llama 3.1 Nemotron Ultra 253B" },
            { id: "meta/llama-4-scout-17b-16e-instruct", name: "Llama 4 Scout 17B 16E Instruct" },
            { id: "meta/llama-4-maverick-17b-128e-instruct", name: "Llama 4 Maverick 17B 128E Instruct" },
            { id: "writer/palmyra-creative-122b", name: "Palmyra Creative 122B" },
            { id: "qwen/qwq-32b", name: "Qwen QWQ 32B" },
            { id: "meta/llama-3.3-70b-instruct", name: "Llama 3.3 70B Instruct" },
            { id: "01-ai/yi-large", name: "Yi Large" },
            { id: "mistralai/mixtral-8x22b-instruct-v0.1", name: "Mixtral 8x22B Instruct v0.1" },
            { id: "deepseek-ai/deepseek-r1", name: "DeepSeek R1" },
            { id: "deepseek-ai/deepseek-r1-0528", name: "DeepSeek R1 0528" },
            { id: "qwen/qwen3-235b-a22b", name: "Qwen3-235B-A22B" }
        ]
    };

    /**
     * Initializes the LlmManager.
     */
    constructor() {
        this._apiKeyIndices = { gemini: 0, openrouter: 0, huggingface: 0, mistral: 0, cohere: 0, nvidia: 0, chutes: 0, requesty: 0 };
        this.apiKeyStatus = { gemini: [], openrouter: [], huggingface: [], mistral: [], cohere: [], nvidia: [], chutes: [], requesty: [] };
        this._hfModelProviderMap = {
            "meta-llama/Llama-3.3-70B-Instruct": "nebius",
            "deepseek-ai/DeepSeek-V3-0324": "sambanova",
            "alpindale/WizardLM-2-8x22B": "novita",
            "cognitivecomputations/dolphin-2.9.2-mixtral-8x22b": "nebius",
            "HuggingFaceH4/zephyr-7b-beta": "hf-inference",
            "Sao10K/L3-8B-Stheno-v3.2": "novita",
            "Sao10K/L3-8B-Lunaris-v1": "novita"
        };
    }

    // --- PUBLIC API ---

    /**
     * Generates a response from the configured LLM provider. This is the main entry point for the module.
     */
    async generateResponse(prompt: Message[], settings: LlmSettings): Promise<string> {
        const provider = settings.provider?.toLowerCase() as Provider;
        const providerMethodName = `_call${this._capitalize(provider)}` as keyof this;

        if (!provider || typeof this[providerMethodName] !== 'function') {
            throw new Error(`Unsupported LLM provider specified: ${settings.provider}`);
        }

        const providerMethod = this[providerMethodName] as (prompt: Message[], settings: LlmSettings) => Promise<string>;
        return await providerMethod.call(this, prompt, settings);
    }

    // --- INTERNAL HELPER METHODS ---

    private _capitalize(s: string): string {
        return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
    }

    private _normalizeApiKeys(apiKeys: ApiKeys, provider: string): string[] {
        const keys = apiKeys?.[provider];
        if (typeof keys === 'string') return keys ? [keys] : [];
        return Array.isArray(keys) ? keys.filter(k => k) : [];
    }

    private _getNextApiKey(provider: Provider, apiKeys: ApiKeys): ApiKeyInfo {
        const normalizedKeys = this._normalizeApiKeys(apiKeys, provider);
        if (normalizedKeys.length === 0) throw new Error(`No API key(s) found for ${provider}.`);

        if (this.apiKeyStatus[provider]?.length !== normalizedKeys.length) {
            this.apiKeyStatus[provider] = new Array(normalizedKeys.length).fill('untested' as ApiKeyStatus);
        }

        if (this._apiKeyIndices[provider] >= normalizedKeys.length) this._apiKeyIndices[provider] = 0;

        const currentIndex = this._apiKeyIndices[provider];
        return { keys: normalizedKeys, currentIndex, currentKey: normalizedKeys[currentIndex] };
    }

    private _markApiKeySuccess(provider: Provider, keyIndex: number, totalKeys: number): void {
        if (this.apiKeyStatus[provider]) this.apiKeyStatus[provider][keyIndex] = 'working';
        this._apiKeyIndices[provider] = (keyIndex + 1) % totalKeys;
    }

    private _markApiKeyFailure(provider: Provider, keyIndex: number, error: Error): void {
        if (this.apiKeyStatus[provider]) {
            const isRateLimit = error.message && (error.message.includes('rate') || error.message.includes('quota') || error.message.includes('429'));
            this.apiKeyStatus[provider][keyIndex] = isRateLimit ? 'rate-limited' : 'failed';
        }
    }

    private async _executeApiCall(providerName: Provider, settings: LlmSettings, prompt: Message[], apiCall: ApiCall): Promise<string> {
        const keyInfo = this._getNextApiKey(providerName, settings.apiKeys);
        let currentIndex = keyInfo.currentIndex;
        let attemptCount = 0;
        let lastError: Error | null = null;

        while (attemptCount < keyInfo.keys.length) {
            const apiKey = keyInfo.keys[currentIndex];
            try {
                const responseText = await apiCall(apiKey, settings, prompt);
                this._markApiKeySuccess(providerName, currentIndex, keyInfo.keys.length);
                return responseText;
            } catch (error) {
                const err = error as Error;
                console.error(`${this._capitalize(providerName)} API key ${currentIndex + 1} failed:`, err.message);
                this._markApiKeyFailure(providerName, currentIndex, err);
                lastError = err;
                currentIndex = (currentIndex + 1) % keyInfo.keys.length;
                attemptCount++;
            }
        }
        throw new Error(`All ${this._capitalize(providerName)} API keys failed. Last error: ${lastError?.message || 'Unknown error'}`);
    }

    // --- PROVIDER IMPLEMENTATIONS ---

    private async _callGemini(prompt: Message[], settings: LlmSettings): Promise<string> {
        return this._executeApiCall('gemini', settings, prompt, async (apiKey: string, settings: LlmSettings, prompt: Message[]) => {
            const { GoogleGenAI } = await import("@google/genai");
            const ai = new GoogleGenAI({ apiKey });
            const contents = prompt.map(msg => ({ role: msg.role === 'assistant' ? 'model' : 'user', parts: [{ text: msg.content }] }));
            const modelsWithThinkingBudget = ["gemini-2.5-pro", "gemini-2.5-pro-preview-05-06", "gemini-2.5-flash-preview-04-17"];
            const useThinkingBudget = modelsWithThinkingBudget.includes(settings.model);

            const request: any = {
                model: settings.model,
                contents: contents,
                generationConfig: {
                    temperature: settings.temperature ?? 0.7,
                    topP: settings.topP ?? 0.9,
                    maxOutputTokens: settings.maxTokens ?? 2048
                },
            };

            if (useThinkingBudget) {
                request.thinkingConfig = { thinkingBudget: 24576 };
            }

            const response = await ai.models.generateContent(request);
            return response?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        });
    }

    private async _callOpenrouter(prompt: Message[], settings: LlmSettings): Promise<string> {
        return this._executeApiCall('openrouter', settings, prompt, async (apiKey: string, settings: LlmSettings, prompt: Message[]) => {
            const fetch = (await import('node-fetch')).default;
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "HTTP-Referer": settings.siteUrl || "http://localhost:3000",
                    "X-Title": settings.siteName || "Axiom LLM Module",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: settings.model,
                    messages: prompt,
                    temperature: settings.temperature ?? 0.7,
                    max_tokens: settings.maxTokens ?? 2048,
                    top_p: settings.topP ?? 0.9
                })
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: response.statusText }));
                throw new Error(`API request failed: ${response.status} ${JSON.stringify(errorData)}`);
            }
            const data = await response.json() as any;
            return data.choices[0].message.content;
        });
    }

    private async _callRequesty(prompt: Message[], settings: LlmSettings): Promise<string> {
        return this._executeApiCall('requesty', settings, prompt, async (apiKey: string, settings: LlmSettings, prompt: Message[]) => {
            const fetch = (await import('node-fetch')).default;
            const response = await fetch("https://router.requesty.ai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": settings.siteUrl || "http://localhost:3000",
                    "X-Title": settings.siteName || "Axiom LLM Module"
                },
                body: JSON.stringify({
                    model: settings.model,
                    messages: prompt,
                    temperature: settings.temperature ?? 0.7,
                    max_tokens: settings.maxTokens ?? 2048,
                    top_p: settings.topP ?? 0.9
                })
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: response.statusText }));
                throw new Error(`API request failed: ${response.status} ${JSON.stringify(errorData)}`);
            }
            const data = await response.json() as any;
            return data.choices[0].message.content;
        });
    }

    private async _callHuggingface(prompt: Message[], settings: LlmSettings): Promise<string> {
        return this._executeApiCall('huggingface', settings, prompt, async (apiKey: string, settings: LlmSettings, prompt: Message[]) => {
            const { HfInference } = await import("@huggingface/inference");
            const client = new HfInference(apiKey);
            const provider = settings.providerOverride || this._hfModelProviderMap[settings.model] || "nebius";

            let output = "";
            const stream = client.chatCompletionStream({
                model: settings.model,
                messages: prompt as any,
                temperature: settings.temperature ?? 0.7,
                max_tokens: settings.maxTokens ?? 2048,
                top_p: settings.topP ?? 0.9,
                provider: provider as any
            });

            for await (const chunk of stream) {
                if (chunk.choices?.[0]?.delta?.content) {
                    output += chunk.choices[0].delta.content;
                }
            }
            return output;
        });
    }

    private async _callMistral(prompt: Message[], settings: LlmSettings): Promise<string> {
        return this._executeApiCall('mistral', settings, prompt, async (apiKey: string, settings: LlmSettings, prompt: Message[]) => {
            const MistralClient = await import('@mistralai/mistralai');
            const client = new (MistralClient as any)({ apiKey });
            const chatResponse = await client.chat.complete({
                model: settings.model,
                messages: prompt,
                temperature: settings.temperature ?? 0.7,
                maxTokens: settings.maxTokens ?? 2048,
                topP: settings.topP ?? 0.9
            });
            return chatResponse.choices[0].message.content;
        });
    }

    private async _callCohere(prompt: Message[], settings: LlmSettings): Promise<string> {
        return this._executeApiCall('cohere', settings, prompt, async (apiKey: string, settings: LlmSettings, prompt: Message[]) => {
            const { CohereClientV2 } = await import('cohere-ai');
            const cohere = new CohereClientV2({ token: apiKey });
            const cohereMessages = prompt.map(msg => ({
                role: msg.role,
                content: typeof msg.content === 'string' ? msg.content : String(msg.content)
            }));
            const response = await cohere.chat({
                model: settings.model,
                messages: cohereMessages,
                temperature: settings.temperature ?? 0.7,
                max_tokens: settings.maxTokens ?? 2048
            } as any);
            return response?.message?.content?.map((c: any) => c.text).join('\n') || "";
        });
    }

    private async _callNvidia(prompt: Message[], settings: LlmSettings): Promise<string> {
        return this._executeApiCall('nvidia', settings, prompt, async (apiKey: string, settings: LlmSettings, prompt: Message[]) => {
            const { default: OpenAI } = await import('openai');
            const openai = new OpenAI({ apiKey, baseURL: 'https://integrate.api.nvidia.com/v1' });

            let patchedMessages: Message[] = prompt;
            const nemotronModels = ['nvidia/llama-3.1-nemotron-ultra-253b-v1', 'nvidia/llama-3.3-nemotron-super-49b-v1'];
            if (nemotronModels.includes(settings.model)) {
                patchedMessages = [{ role: 'system', content: 'detailed thinking on' }, ...prompt];
            }

            let extraParams: any = {};
            if (settings.model?.toLowerCase() === 'qwen/qwen3-235b-a22b') {
                extraParams = { chat_template_kwargs: { thinking: true } };
            }

            const completion = await openai.chat.completions.create({
                model: settings.model,
                messages: patchedMessages as any,
                temperature: settings.temperature ?? 0.7,
                top_p: settings.topP ?? 0.9,
                max_tokens: settings.maxTokens ?? 2048,
                stream: false,
                ...extraParams
            });
            return completion.choices[0].message.content || "";
        });
    }

    private async _callChutes(prompt: Message[], settings: LlmSettings): Promise<string> {
        return this._executeApiCall('chutes', settings, prompt, async (apiKey: string, settings: LlmSettings, prompt: Message[]) => {
            const fetch = (await import('node-fetch')).default;
            const response = await fetch("https://llm.chutes.ai/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: settings.model,
                    messages: prompt,
                    stream: false,
                    max_tokens: settings.maxTokens ?? 1024,
                    temperature: settings.temperature ?? 0.7
                })
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: response.statusText }));
                throw new Error(`API request failed: ${response.status} ${JSON.stringify(errorData)}`);
            }
            const data = await response.json() as any;
            return data.choices[0].message.content;
        });
    }
}

// --- USAGE EXAMPLE ---
/*

async function main() {
    // 1. Instantiate the manager
    const llmManager = new LlmManager();

    // 2. Define your settings for a provider with special requirements (NVIDIA Nemotron)
    const settings = {
        provider: 'nvidia',
        model: 'nvidia/llama-3.1-nemotron-ultra-253b-v1',
        apiKeys: {
            // Provide an array of keys for rotation and fallback
            nvidia: [
                'nvapi-this-is-an-invalid-key-for-testing',
                'nvapi-your-real-nvidia-api-key-here'
            ]
        },
        temperature: 0.75,
    };

    // 3. Create your prompt
    const prompt = [
        { role: 'system', content: 'You are a historian specializing in ancient Rome.' },
        { role: 'user', content: 'Describe the key factors that led to the fall of the Western Roman Empire.' }
    ];

    // 4. Call the manager to get a response
    try {
        console.log(`Sending request to ${settings.provider} with model ${settings.model}...`);
        const response = await llmManager.generateResponse(prompt, settings);
        console.log("\n--- LLM Response ---");
        console.log(response);
        console.log("--------------------\n");

        // 5. Inspect the status of your API keys
        console.log("API Key Statuses:", llmManager.apiKeyStatus.nvidia);

    } catch (error) {
        console.error("\n--- ERROR ---");
        console.error(error.message);
        console.log("---------------");
        console.log("Final API Key Statuses:", llmManager.apiKeyStatus.nvidia);
    }
}

// To run the example:
// main();

*/

// Export types for external use
export type { Message, ModelConfiguration, ApiKeys, LlmSettings, ApiKeyStatus, Provider };

// Export the class for use in other modules
export default LlmManager;
