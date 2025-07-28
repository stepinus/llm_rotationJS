"use strict";
/**
 * @file transformations.ts
 * @description Request/response transformation utilities for converting between
 * OpenAI API format and LlmManager format, including token estimation utilities
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.transformRequest = transformRequest;
exports.transformResponse = transformResponse;
exports.estimateTokens = estimateTokens;
exports.estimateTokensWithRoles = estimateTokensWithRoles;
exports.createStreamingTransformer = createStreamingTransformer;
exports.validateTransformationRequest = validateTransformationRequest;
exports.transformError = transformError;
/**
 * Transform OpenAI API request format to LlmManager settings format
 * @param openaiRequest - The incoming OpenAI-compatible request
 * @param provider - The detected provider for this request
 * @param apiKeys - Available API keys for all providers
 * @param defaultSettings - Default server settings to use as fallbacks
 * @returns LlmSettings object compatible with LlmManager
 */
function transformRequest(openaiRequest, provider, apiKeys, defaultSettings) {
    return {
        provider,
        model: openaiRequest.model,
        apiKeys,
        temperature: openaiRequest.temperature ?? defaultSettings?.temperature ?? 0.7,
        maxTokens: openaiRequest.max_tokens ?? defaultSettings?.maxTokens ?? 2048,
        topP: openaiRequest.top_p ?? defaultSettings?.topP ?? 0.9,
        siteUrl: defaultSettings?.siteUrl ?? 'http://localhost:3000',
        siteName: defaultSettings?.siteName ?? 'LLM Rotation Server'
    };
}
/**
 * Transform LlmManager response to OpenAI API response format
 * @param content - The response content from LlmManager
 * @param model - The model that was used for generation
 * @param messages - The original messages sent to the model (for token estimation)
 * @param requestId - Optional request ID for tracking
 * @returns OpenAI-compatible chat completion response
 */
function transformResponse(content, model, messages, requestId) {
    const promptTokens = estimateTokens(messages);
    const completionTokens = estimateTokens([{ role: 'assistant', content }]);
    const choice = {
        index: 0,
        message: {
            role: 'assistant',
            content
        },
        finish_reason: 'stop'
    };
    const usage = {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens
    };
    return {
        id: requestId ? `chatcmpl-${requestId}` : `chatcmpl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [choice],
        usage
    };
}
/**
 * Estimate the number of tokens in a message or array of messages
 * This is a rough approximation based on common tokenization patterns
 * @param input - Single message, array of messages, or string content
 * @returns Estimated token count
 */
function estimateTokens(input) {
    let text;
    if (typeof input === 'string') {
        text = input;
    }
    else if (Array.isArray(input)) {
        // For message arrays, concatenate all content
        text = input.map(msg => msg.content).join(' ');
    }
    else {
        // Single message
        text = input.content;
    }
    if (!text || typeof text !== 'string') {
        return 0;
    }
    // Basic token estimation algorithm
    // This is a simplified approximation - real tokenizers are more complex
    // Remove extra whitespace and normalize
    const normalizedText = text.trim().replace(/\s+/g, ' ');
    if (normalizedText.length === 0) {
        return 0;
    }
    // Split by common word boundaries and punctuation
    const words = normalizedText.split(/[\s\-_.,!?;:()\[\]{}'"]+/).filter(word => word.length > 0);
    let tokenCount = 0;
    for (const word of words) {
        if (word.length === 0)
            continue;
        // Very short words (1-2 chars) are usually 1 token
        if (word.length <= 2) {
            tokenCount += 1;
        }
        // Short words (3-4 chars) are usually 1 token
        else if (word.length <= 4) {
            tokenCount += 1;
        }
        // Medium words (5-8 chars) might be 1-2 tokens
        else if (word.length <= 8) {
            tokenCount += Math.ceil(word.length / 4);
        }
        // Longer words are typically broken into multiple tokens
        else {
            // Rough approximation: 1 token per 3-4 characters for longer words
            tokenCount += Math.ceil(word.length / 3.5);
        }
    }
    // Add some tokens for special characters, formatting, etc.
    const specialCharCount = (normalizedText.match(/[^\w\s]/g) || []).length;
    tokenCount += Math.ceil(specialCharCount / 4);
    // Ensure minimum of 1 token for non-empty text, but allow 0 for empty text
    return Math.max(normalizedText.length > 0 ? 1 : 0, Math.round(tokenCount));
}
/**
 * Estimate tokens more accurately for specific message roles
 * Takes into account role-specific formatting that might affect tokenization
 * @param messages - Array of messages to estimate tokens for
 * @returns Estimated token count including role formatting overhead
 */
function estimateTokensWithRoles(messages) {
    let totalTokens = 0;
    for (const message of messages) {
        // Base content tokens
        const contentTokens = estimateTokens(message.content);
        // Add overhead for role formatting
        // Different roles might have different formatting overhead in the actual tokenizer
        let roleOverhead = 0;
        switch (message.role) {
            case 'system':
                roleOverhead = 4; // "<|system|>" or similar formatting
                break;
            case 'user':
                roleOverhead = 3; // "<|user|>" or similar
                break;
            case 'assistant':
                roleOverhead = 4; // "<|assistant|>" or similar
                break;
            default:
                roleOverhead = 2; // Generic role formatting
        }
        totalTokens += contentTokens + roleOverhead;
    }
    // Add some overhead for conversation formatting
    const conversationOverhead = Math.max(2, Math.ceil(messages.length / 2));
    return totalTokens + conversationOverhead;
}
/**
 * Create a streaming response transformer for handling streaming responses
 * This is a utility for future streaming support
 * @param model - The model being used
 * @param requestId - Request ID for tracking
 * @returns Function to transform streaming chunks
 */
function createStreamingTransformer(model, requestId) {
    const id = requestId || `chatcmpl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const created = Math.floor(Date.now() / 1000);
    return function transformStreamChunk(content, isLast = false) {
        const choice = {
            index: 0,
            delta: isLast ? {} : { content },
            finish_reason: isLast ? 'stop' : null
        };
        return {
            id,
            object: 'chat.completion.chunk',
            created,
            model,
            choices: [choice]
        };
    };
}
/**
 * Validate that a request can be properly transformed
 * @param request - The OpenAI request to validate
 * @returns Array of validation errors, empty if valid
 */
function validateTransformationRequest(request) {
    const errors = [];
    if (!request.model || typeof request.model !== 'string') {
        errors.push('Model is required and must be a string');
    }
    if (!request.messages || !Array.isArray(request.messages)) {
        errors.push('Messages is required and must be an array');
    }
    else {
        if (request.messages.length === 0) {
            errors.push('Messages array cannot be empty');
        }
        for (let i = 0; i < request.messages.length; i++) {
            const message = request.messages[i];
            if (!message.role || !['system', 'user', 'assistant'].includes(message.role)) {
                errors.push(`Message ${i}: role must be 'system', 'user', or 'assistant'`);
            }
            if (!message.content || typeof message.content !== 'string') {
                errors.push(`Message ${i}: content is required and must be a string`);
            }
        }
    }
    // Validate optional numeric parameters
    if (request.temperature !== undefined) {
        if (typeof request.temperature !== 'number' || request.temperature < 0 || request.temperature > 2) {
            errors.push('Temperature must be a number between 0 and 2');
        }
    }
    if (request.max_tokens !== undefined) {
        if (typeof request.max_tokens !== 'number' || request.max_tokens < 1) {
            errors.push('max_tokens must be a positive number');
        }
    }
    if (request.top_p !== undefined) {
        if (typeof request.top_p !== 'number' || request.top_p < 0 || request.top_p > 1) {
            errors.push('top_p must be a number between 0 and 1');
        }
    }
    return errors;
}
/**
 * Transform error from LlmManager to OpenAI-compatible error format
 * @param error - The error from LlmManager
 * @param model - The model that was being used
 * @param provider - The provider that failed
 * @returns OpenAI-compatible error response
 */
function transformError(error, model, provider) {
    const message = error.message || 'An unknown error occurred';
    // Determine error type based on error message patterns (case insensitive)
    let type = 'api_error';
    let code = 'provider_error';
    const lowerMessage = message.toLowerCase();
    // Check for keys exhausted first (most specific)
    if (lowerMessage.includes('keys failed') || lowerMessage.includes('keys exhausted')) {
        type = 'api_error';
        code = 'keys_exhausted';
    }
    else if (lowerMessage.includes('api key') || lowerMessage.includes('authentication') || lowerMessage.includes('unauthorized')) {
        type = 'authentication_error';
        code = 'invalid_api_key';
    }
    else if (lowerMessage.includes('rate') || lowerMessage.includes('quota') || lowerMessage.includes('429')) {
        type = 'rate_limit_error';
        code = 'rate_limited';
    }
    else if (lowerMessage.includes('validation') || lowerMessage.includes('invalid')) {
        type = 'invalid_request_error';
        code = 'validation_failed';
    }
    return {
        error: {
            message,
            type,
            code,
            details: {
                provider,
                model,
                timestamp: new Date().toISOString()
            }
        }
    };
}
//# sourceMappingURL=transformations.js.map