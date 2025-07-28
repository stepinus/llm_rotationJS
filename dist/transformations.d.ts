/**
 * @file transformations.ts
 * @description Request/response transformation utilities for converting between
 * OpenAI API format and LlmManager format, including token estimation utilities
 */
import type { ChatCompletionRequest, ChatCompletionResponse, Message, LlmSettings, ApiKeys, Provider } from './types';
/**
 * Transform OpenAI API request format to LlmManager settings format
 * @param openaiRequest - The incoming OpenAI-compatible request
 * @param provider - The detected provider for this request
 * @param apiKeys - Available API keys for all providers
 * @param defaultSettings - Default server settings to use as fallbacks
 * @returns LlmSettings object compatible with LlmManager
 */
export declare function transformRequest(openaiRequest: ChatCompletionRequest, provider: Provider, apiKeys: ApiKeys, defaultSettings?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    siteUrl?: string;
    siteName?: string;
}): LlmSettings;
/**
 * Transform LlmManager response to OpenAI API response format
 * @param content - The response content from LlmManager
 * @param model - The model that was used for generation
 * @param messages - The original messages sent to the model (for token estimation)
 * @param requestId - Optional request ID for tracking
 * @returns OpenAI-compatible chat completion response
 */
export declare function transformResponse(content: string, model: string, messages: Message[], requestId?: string): ChatCompletionResponse;
/**
 * Estimate the number of tokens in a message or array of messages
 * This is a rough approximation based on common tokenization patterns
 * @param input - Single message, array of messages, or string content
 * @returns Estimated token count
 */
export declare function estimateTokens(input: Message[] | Message | string): number;
/**
 * Estimate tokens more accurately for specific message roles
 * Takes into account role-specific formatting that might affect tokenization
 * @param messages - Array of messages to estimate tokens for
 * @returns Estimated token count including role formatting overhead
 */
export declare function estimateTokensWithRoles(messages: Message[]): number;
/**
 * Create a streaming response transformer for handling streaming responses
 * This is a utility for future streaming support
 * @param model - The model being used
 * @param requestId - Request ID for tracking
 * @returns Function to transform streaming chunks
 */
export declare function createStreamingTransformer(model: string, requestId?: string): (content: string, isLast?: boolean) => {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: any[];
};
/**
 * Validate that a request can be properly transformed
 * @param request - The OpenAI request to validate
 * @returns Array of validation errors, empty if valid
 */
export declare function validateTransformationRequest(request: ChatCompletionRequest): string[];
/**
 * Transform error from LlmManager to OpenAI-compatible error format
 * @param error - The error from LlmManager
 * @param model - The model that was being used
 * @param provider - The provider that failed
 * @returns OpenAI-compatible error response
 */
export declare function transformError(error: Error, model?: string, provider?: string): {
    error: {
        message: string;
        type: "invalid_request_error" | "authentication_error" | "api_error" | "rate_limit_error";
        code: string;
        details: {
            provider: string | undefined;
            model: string | undefined;
            timestamp: string;
        };
    };
};
//# sourceMappingURL=transformations.d.ts.map