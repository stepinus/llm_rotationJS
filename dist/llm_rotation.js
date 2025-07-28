"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.LlmManager = void 0;
class LlmManager {
    _apiKeyIndices;
    apiKeyStatus;
    _hfModelProviderMap;
    /**
     * A static property containing detailed model configurations for various providers.
     * Useful for populating UI dropdowns and understanding model capabilities.
     */
    static modelConfigurations = {
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
    async generateResponse(prompt, settings) {
        const provider = settings.provider?.toLowerCase();
        const providerMethodName = `_call${this._capitalize(provider)}`;
        if (!provider || typeof this[providerMethodName] !== 'function') {
            throw new Error(`Unsupported LLM provider specified: ${settings.provider}`);
        }
        const providerMethod = this[providerMethodName];
        return await providerMethod.call(this, prompt, settings);
    }
    // --- INTERNAL HELPER METHODS ---
    _capitalize(s) {
        return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
    }
    _normalizeApiKeys(apiKeys, provider) {
        const keys = apiKeys?.[provider];
        if (typeof keys === 'string')
            return keys ? [keys] : [];
        return Array.isArray(keys) ? keys.filter(k => k) : [];
    }
    _getNextApiKey(provider, apiKeys) {
        const normalizedKeys = this._normalizeApiKeys(apiKeys, provider);
        if (normalizedKeys.length === 0)
            throw new Error(`No API key(s) found for ${provider}.`);
        if (this.apiKeyStatus[provider]?.length !== normalizedKeys.length) {
            this.apiKeyStatus[provider] = new Array(normalizedKeys.length).fill('untested');
        }
        if (this._apiKeyIndices[provider] >= normalizedKeys.length)
            this._apiKeyIndices[provider] = 0;
        const currentIndex = this._apiKeyIndices[provider];
        return { keys: normalizedKeys, currentIndex, currentKey: normalizedKeys[currentIndex] };
    }
    _markApiKeySuccess(provider, keyIndex, totalKeys) {
        if (this.apiKeyStatus[provider])
            this.apiKeyStatus[provider][keyIndex] = 'working';
        this._apiKeyIndices[provider] = (keyIndex + 1) % totalKeys;
    }
    _markApiKeyFailure(provider, keyIndex, error) {
        if (this.apiKeyStatus[provider]) {
            const isRateLimit = error.message && (error.message.includes('rate') || error.message.includes('quota') || error.message.includes('429'));
            this.apiKeyStatus[provider][keyIndex] = isRateLimit ? 'rate-limited' : 'failed';
        }
    }
    async _executeApiCall(providerName, settings, prompt, apiCall) {
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
            }
            catch (error) {
                const err = error;
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
    async _callGemini(prompt, settings) {
        return this._executeApiCall('gemini', settings, prompt, async (apiKey, settings, prompt) => {
            const { GoogleGenAI } = await Promise.resolve().then(() => __importStar(require("@google/genai")));
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
        return this._executeApiCall('openrouter', settings, prompt, async (apiKey, settings, prompt) => {
            const fetch = (await Promise.resolve().then(() => __importStar(require('node-fetch')))).default;
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
        return this._executeApiCall('requesty', settings, prompt, async (apiKey, settings, prompt) => {
            const fetch = (await Promise.resolve().then(() => __importStar(require('node-fetch')))).default;
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
        return this._executeApiCall('huggingface', settings, prompt, async (apiKey, settings, prompt) => {
            const { HfInference } = await Promise.resolve().then(() => __importStar(require("@huggingface/inference")));
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
        return this._executeApiCall('mistral', settings, prompt, async (apiKey, settings, prompt) => {
            const MistralClient = await Promise.resolve().then(() => __importStar(require('@mistralai/mistralai')));
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
        return this._executeApiCall('cohere', settings, prompt, async (apiKey, settings, prompt) => {
            const { CohereClientV2 } = await Promise.resolve().then(() => __importStar(require('cohere-ai')));
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
            });
            return response?.message?.content?.map((c) => c.text).join('\n') || "";
        });
    }
    async _callNvidia(prompt, settings) {
        return this._executeApiCall('nvidia', settings, prompt, async (apiKey, settings, prompt) => {
            const { default: OpenAI } = await Promise.resolve().then(() => __importStar(require('openai')));
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
            return completion.choices[0].message.content || "";
        });
    }
    async _callChutes(prompt, settings) {
        return this._executeApiCall('chutes', settings, prompt, async (apiKey, settings, prompt) => {
            const fetch = (await Promise.resolve().then(() => __importStar(require('node-fetch')))).default;
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
exports.LlmManager = LlmManager;
// Export the class for use in other modules
exports.default = LlmManager;
//# sourceMappingURL=llm_rotation.js.map