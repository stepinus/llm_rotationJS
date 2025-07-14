/**
 * @file LlmManager.js
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

class LlmManager {

    /**
     * A static property containing detailed model configurations for various providers.
     * Useful for populating UI dropdowns and understanding model capabilities.
     */
    static modelConfigurations = {
        openrouter: [
            { id: "google/gemini-2.0-flash-exp:free", name: "Gemini 2.0 Flash Exp (Free)", free: true },
            { id: "microsoft/mai-ds-r1:free", name: "MAI-DS R1 (Free)", free: true },
            { id: "arliai/qwq-32b-arliai-rpr-v1:free", name: "QWQ 32B RPR", free: true },
            { id: "deepseek/deepseek-chat-v3-0324:free", name: "DeepSeek Chat v3", free: true },
            { id: "rekaai/reka-flash-3:free", name: "Reka Flash 3", free: true },
            { id: "minimax/minimax-m1:extended", name: "MiniMax M1 Extended", free: true }
        ],
        huggingface: [
            { id: "meta-llama/Llama-3.3-70B-Instruct", name: "Llama 3.3 70B Instruct", provider: "nebius" },
            { id: "deepseek-ai/DeepSeek-V3-0324", name: "DeepSeek V3", provider: "sambanova" },
            { id: "alpindale/WizardLM-2-8x22B", name: "WizardLM 2 8x22B", provider: "novita" },
            { id: "cognitivecomputations/dolphin-2.9.2-mixtral-8x22b", name: "Dolphin 2.9.2 Mixtral 8x22B", provider: "nebius" },
        ],
        gemini: [
            { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
            { id: "gemini-2.5-pro-preview-05-06", name: "Gemini 2.5 Pro Preview" },
            { id: "gemini-2.5-flash-preview-04-17", name: "Gemini 2.5 Flash Preview 04-17" },
            { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash" },
            { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro" },
        ],
        mistral: [
            { id: "mistral-large-latest", name: "Mistral Large" },
            { id: "mistral-medium-latest", name: "Mistral Medium" },
            { id: "mistral-small-latest", name: "Mistral Small" },
            { id: "open-mistral-nemo", name: "Open Mistral Nemo" }
        ],
        cohere: [
            { id: "command-a-03-2025", name: "Command A 03-2025", free: true },
            { id: "command-r-plus-08-2024", name: "Command R Plus 08-2024", free: true },
            { id: "command-r-08-2024", name: "Command R 08-2024", free: true },
        ],
        chutes: [
            { id: "deepseek-ai/DeepSeek-R1", name: "DeepSeek R1" },
            { id: "deepseek-ai/DeepSeek-V3-0324", name: "DeepSeek V3 (0324)" },
            { id: "ArliAI/QwQ-32B-ArliAI-RpR-v1", name: "ArliAI QwQ 32B RPR v1" },
            { id: "microsoft/MAI-DS-R1-FP8", name: "Microsoft MAI-DS R1 FP8" },
        ],
        nvidia: [
            { id: "nvidia/llama-3.1-nemotron-ultra-253b-v1", name: "Llama 3.1 Nemotron Ultra 253B" },
            { id: "meta/llama-4-maverick-17b-128e-instruct", name: "Llama 4 Maverick 17B 128E Instruct" },
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
            "alpindale/WizardLM-2-8x22B": "novita",
            "deepseek-ai/DeepSeek-V3-0324": "sambanova",
            "cognitivecomputations/dolphin-2.9.2-mixtral-8x22b": "nebius",
            "HuggingFaceH4/zephyr-7b-beta": "hf-inference",
            "meta-llama/Llama-3.3-70B-Instruct": "nebius",
            "Sao10K/L3-8B-Stheno-v3.2": "novita",
            "Sao10K/L3-8B-Lunaris-v1": "novita"
        };
    }

    // --- PUBLIC API ---

    /**
     * Generates a response from the configured LLM provider. This is the main entry point for the module.
     *
     * @param {Array<object>} prompt - The message history/prompt, e.g., [{ role: 'user', content: 'Hello' }].
     * @param {object} settings - Configuration for the LLM call.
     * @param {string} settings.provider - The LLM provider to use (e.g., 'gemini', 'openrouter').
     * @param {string} settings.model - The specific model to use.
     * @param {object} settings.apiKeys - Object containing API keys for providers, e.g., { gemini: 'key1' } or { gemini: ['key1', 'key2'] }.
     * @param {number} [settings.temperature=0.7] - The generation temperature.
     * @param {number} [settings.topP=0.9] - The top-p value for nucleus sampling.
     * @param {number} [settings.maxTokens=2048] - The maximum number of tokens to generate.
     * @param {string} [settings.siteUrl] - Required for OpenRouter & Requesty.
     * @param {string} [settings.siteName] - Required for OpenRouter & Requesty.
     * @param {string} [settings.providerOverride] - For HuggingFace, manually specify an underlying provider.
     * @returns {Promise<string>} The generated text response.
     * @throws {Error} If the provider is unsupported or all API keys fail.
     */
    async generateResponse(prompt, settings) {
        const provider = settings.provider?.toLowerCase();
        const providerMethodName = `_call${this._capitalize(provider)}`;

        if (!provider || !this[providerMethodName]) {
            throw new Error(`Unsupported LLM provider specified: ${settings.provider}`);
        }

        const providerMethod = this[providerMethodName].bind(this);
        return await providerMethod(prompt, settings);
    }

    // --- INTERNAL HELPER METHODS ---

    _capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

    _normalizeApiKeys(apiKeys, provider) {
        const keys = apiKeys?.[provider];
        if (typeof keys === 'string') return keys ? [keys] : [];
        return Array.isArray(keys) ? keys.filter(k => k) : [];
    }

    _getNextApiKey(provider, apiKeys) {
        const normalizedKeys = this._normalizeApiKeys(apiKeys, provider);
        if (normalizedKeys.length === 0) throw new Error(`No API key(s) found for ${provider}.`);

        if (this.apiKeyStatus[provider]?.length !== normalizedKeys.length) {
            this.apiKeyStatus[provider] = new Array(normalizedKeys.length).fill('untested');
        }

        if (this._apiKeyIndices[provider] >= normalizedKeys.length) this._apiKeyIndices[provider] = 0;

        const currentIndex = this._apiKeyIndices[provider];
        return { keys: normalizedKeys, currentIndex, currentKey: normalizedKeys[currentIndex] };
    }

    _markApiKeySuccess(provider, keyIndex, totalKeys) {
        if (this.apiKeyStatus[provider]) this.apiKeyStatus[provider][keyIndex] = 'working';
        this._apiKeyIndices[provider] = (keyIndex + 1) % totalKeys;
    }

    _markApiKeyFailure(provider, keyIndex, error) {
        if (this.apiKeyStatus[provider]) {
            const isRateLimit = error.message && (error.message.includes('rate') || error.message.includes('quota') || error.message.includes('429'));
            this.apiKeyStatus[provider][keyIndex] = isRateLimit ? 'rate-limited' : 'failed';
        }
    }

    async _executeApiCall(providerName, settings, apiCall) {
        const keyInfo = this._getNextApiKey(providerName, settings.apiKeys);
        let currentIndex = keyInfo.currentIndex;
        let attemptCount = 0;
        let lastError = null;

        while (attemptCount < keyInfo.keys.length) {
            const apiKey = keyInfo.keys[currentIndex];
            try {
                const responseText = await apiCall(apiKey, settings, prompt);
                this._markApiKeySuccess(providerName, currentIndex, keyInfo.keys.length);
                return responseText;
            } catch (error) {
                console.error(`${this._capitalize(providerName)} API key ${currentIndex + 1} failed:`, error.message);
                this._markApiKeyFailure(providerName, currentIndex, error);
                lastError = error;
                currentIndex = (currentIndex + 1) % keyInfo.keys.length;
                attemptCount++;
            }
        }
        throw new Error(`All ${this._capitalize(providerName)} API keys failed. Last error: ${lastError?.message || 'Unknown error'}`);
    }

    // --- PROVIDER IMPLEMENTATIONS ---

    async _callGemini(prompt, settings) {
        return this._executeApiCall('gemini', settings, async (apiKey, settings) => {
            const { GoogleGenAI } = await import("@google/genai");
            const ai = new GoogleGenAI({ apiKey });
            const contents = prompt.map(msg => ({ role: msg.role === 'assistant' ? 'model' : 'user', parts: [{ text: msg.content }] }));
            const modelsWithThinkingBudget = ["gemini-2.5-pro", "gemini-2.5-pro-preview-05-06", "gemini-2.5-flash-preview-04-17"];
            const useThinkingBudget = modelsWithThinkingBudget.includes(settings.model);

            const request = {
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

    async _callOpenrouter(prompt, settings) {
        return this._executeApiCall('openrouter', settings, async (apiKey, settings) => {
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
            const data = await response.json();
            return data.choices[0].message.content;
        });
    }
    
    async _callRequesty(prompt, settings) {
        return this._executeApiCall('requesty', settings, async (apiKey, settings) => {
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
            const data = await response.json();
            return data.choices[0].message.content;
        });
    }

    async _callHuggingface(prompt, settings) {
        return this._executeApiCall('huggingface', settings, async (apiKey, settings) => {
            const { HfInference } = await import("@huggingface/inference");
            const client = new HfInference(apiKey);
            const provider = settings.providerOverride || this._hfModelProviderMap[settings.model] || "nebius";
            
            let output = "";
            const stream = client.chatCompletionStream({
                model: settings.model,
                messages: prompt,
                temperature: settings.temperature ?? 0.7,
                max_tokens: settings.maxTokens ?? 2048,
                top_p: settings.topP ?? 0.9,
                provider: provider
            });

            for await (const chunk of stream) {
                if (chunk.choices?.[0]?.delta?.content) {
                    output += chunk.choices[0].delta.content;
                }
            }
            return output;
        });
    }

    async _callMistral(prompt, settings) {
        return this._executeApiCall('mistral', settings, async (apiKey, settings) => {
            const { default: MistralClient } = await import('@mistralai/mistralai');
            const client = new MistralClient({ apiKey });
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

    async _callCohere(prompt, settings) {
        return this._executeApiCall('cohere', settings, async (apiKey, settings) => {
            const { CohereClientV2 } = await import('cohere-ai');
            const cohere = new CohereClientV2({ token: apiKey });
            const cohereMessages = prompt.map(msg => ({
                role: msg.role,
                content: typeof msg.content === 'string' ? msg.content : String(msg.content)
            }));
            const response = await cohere.chat({
                model: settings.model,
                messages: cohereMessages,
                stream: false,
                temperature: settings.temperature ?? 0.7,
                max_tokens: settings.maxTokens ?? 2048
            });
            return response?.message?.content?.map(c => c.text).join('\n') || "";
        });
    }

    async _callNvidia(prompt, settings) {
        return this._executeApiCall('nvidia', settings, async (apiKey, settings) => {
            const { default: OpenAI } = await import('openai');
            const openai = new OpenAI({ apiKey, baseURL: 'https://integrate.api.nvidia.com/v1' });
            
            let patchedMessages = prompt;
            const nemotronModels = ['nvidia/llama-3.1-nemotron-ultra-253b-v1', 'nvidia/llama-3.3-nemotron-super-49b-v1'];
            if (nemotronModels.includes(settings.model)) {
                patchedMessages = [{ role: 'system', content: 'detailed thinking on' }, ...prompt];
            }

            let extraParams = {};
            if (settings.model?.toLowerCase() === 'qwen/qwen3-235b-a22b') {
                extraParams = { chat_template_kwargs: { thinking: true } };
            }

            const completion = await openai.chat.completions.create({
                model: settings.model,
                messages: patchedMessages,
                temperature: settings.temperature ?? 0.7,
                top_p: settings.topP ?? 0.9,
                max_tokens: settings.maxTokens ?? 2048,
                stream: false,
                ...extraParams
            });
            return completion.choices[0].message.content;
        });
    }

    async _callChutes(prompt, settings) {
        return this._executeApiCall('chutes', settings, async (apiKey, settings) => {
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
            const data = await response.json();
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

// Export the class for use in other modules
export default LlmManager;