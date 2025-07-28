"use strict";
/**
 * @file types.ts
 * @description Core TypeScript interfaces and types for the LLM Rotation Server
 * Provides OpenAI API compatible interfaces, server configuration types,
 * and error handling types while extending types from llm_rotation.ts
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiError = void 0;
/**
 * Custom API Error class with structured error information
 */
class ApiError extends Error {
    type;
    code;
    details;
    statusCode;
    constructor(message, type, code, statusCode = 500, details) {
        super(message);
        this.name = 'ApiError';
        this.type = type;
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ApiError);
        }
    }
    /**
     * Convert the error to an OpenAI-compatible error response
     */
    toResponse() {
        return {
            error: {
                message: this.message,
                type: this.type,
                code: this.code,
                details: this.details
            }
        };
    }
    /**
     * Create a validation error
     */
    static validation(message, fieldErrors) {
        return new ApiError(message, 'invalid_request_error', 'validation_failed', 400, { fieldErrors });
    }
    /**
     * Create an authentication error
     */
    static authentication(message, provider) {
        return new ApiError(message, 'authentication_error', 'invalid_api_key', 401, { provider });
    }
    /**
     * Create a model not found error
     */
    static modelNotFound(model) {
        return new ApiError(`Model '${model}' not found or not supported`, 'invalid_request_error', 'model_not_found', 400, { requestId: `req_${Date.now()}` });
    }
    /**
     * Create a keys exhausted error
     */
    static keysExhausted(provider, keyStatuses, lastError) {
        return new ApiError(`All ${provider} API keys failed. Last error: ${lastError || 'Unknown error'}`, 'api_error', 'keys_exhausted', 502, {
            provider,
            keyStatuses,
            lastError,
            timestamp: new Date().toISOString()
        });
    }
    /**
     * Create a rate limit error
     */
    static rateLimit(provider, retryAfter) {
        return new ApiError(`Rate limit exceeded for ${provider}${retryAfter ? `. Retry after ${retryAfter} seconds` : ''}`, 'rate_limit_error', 'rate_limited', 429, { provider, timestamp: new Date().toISOString() });
    }
    /**
     * Create a timeout error
     */
    static timeout(provider, timeoutMs) {
        return new ApiError(`Request to ${provider} timed out after ${timeoutMs}ms`, 'api_error', 'timeout_error', 504, { provider, timestamp: new Date().toISOString() });
    }
}
exports.ApiError = ApiError;
//# sourceMappingURL=types.js.map