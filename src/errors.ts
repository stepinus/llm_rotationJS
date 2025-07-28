/**
 * @file errors.ts
 * @description Error handling utilities for the LLM Rotation Server
 * Provides error transformation utilities, key rotation specific error handling,
 * and error response formatting functions
 */

import { ApiError, ApiErrorType, ApiErrorCode, ErrorResponse, ErrorDetails } from './types';
import { Provider, ApiKeyStatus } from './llm_rotation';
import LlmManager from './llm_rotation';

/**
 * Transform generic errors into structured ApiError instances
 */
export class ErrorTransformer {
    /**
     * Transform a generic error into an ApiError with appropriate type and code
     */
    static fromGenericError(error: Error, context?: { provider?: string; model?: string }): ApiError {
        const message = error.message || 'Unknown error occurred';
        
        // Check for specific error patterns
        if (message.toLowerCase().includes('rate') || message.toLowerCase().includes('quota') || message.includes('429')) {
            return ApiError.rateLimit(context?.provider || 'unknown');
        }
        
        if (message.includes('authentication') || message.includes('401') || message.includes('unauthorized')) {
            return ApiError.authentication(message, context?.provider);
        }
        
        if (message.includes('timeout') || message.includes('ETIMEDOUT')) {
            return ApiError.timeout(context?.provider || 'unknown', 30000);
        }
        
        if (message.includes('model') && message.includes('not found')) {
            return ApiError.modelNotFound(context?.model || 'unknown');
        }
        
        if (message.includes('All') && message.includes('failed')) {
            // This is likely a key exhaustion error from LlmManager
            return new ApiError(
                message,
                'api_error',
                'keys_exhausted',
                502,
                {
                    provider: context?.provider,
                    lastError: message,
                    timestamp: new Date().toISOString()
                }
            );
        }
        
        // Default to server error
        return new ApiError(
            message,
            'server_error',
            'internal_error',
            500,
            {
                timestamp: new Date().toISOString(),
                lastError: message
            }
        );
    }
    
    /**
     * Transform validation errors into structured ApiError
     */
    static fromValidationError(message: string, fieldErrors?: Record<string, string>): ApiError {
        return ApiError.validation(message, fieldErrors);
    }
    
    /**
     * Transform provider-specific errors into ApiError
     */
    static fromProviderError(error: Error, provider: string): ApiError {
        const message = error.message || `Provider ${provider} error`;
        
        // Check for provider-specific error patterns
        if (message.includes('insufficient_quota') || message.includes('quota')) {
            return new ApiError(
                `Insufficient quota for ${provider}`,
                'api_error',
                'insufficient_quota',
                429,
                { provider, lastError: message, timestamp: new Date().toISOString() }
            );
        }
        
        if (message.includes('model_not_found') || message.includes('model not found')) {
            return new ApiError(
                `Model not found on ${provider}`,
                'invalid_request_error',
                'model_not_found',
                400,
                { provider, lastError: message }
            );
        }
        
        // Default provider error
        return new ApiError(
            `Provider ${provider} error: ${message}`,
            'api_error',
            'provider_error',
            502,
            {
                provider,
                lastError: message,
                timestamp: new Date().toISOString()
            }
        );
    }
}

/**
 * Key rotation specific error handling utilities
 */
export class KeyRotationErrorHandler {
    /**
     * Handle key exhaustion errors with detailed status information
     */
    static handleKeyExhaustion(
        provider: Provider, 
        error: Error, 
        llmManager: LlmManager
    ): ApiError {
        const keyStatuses = llmManager.apiKeyStatus[provider] || [];
        
        return new ApiError(
            `All ${provider} API keys failed. Last error: ${error.message}`,
            'api_error',
            'keys_exhausted',
            502,
            {
                provider,
                keyStatuses,
                lastError: error.message,
                timestamp: new Date().toISOString()
            }
        );
    }
    
    /**
     * Handle individual key failures
     */
    static handleKeyFailure(
        provider: Provider,
        keyIndex: number,
        error: Error,
        totalKeys: number
    ): ApiError {
        const isRateLimit = error.message && (
            error.message.toLowerCase().includes('rate') || 
            error.message.toLowerCase().includes('quota') || 
            error.message.includes('429')
        );
        
        if (isRateLimit) {
            return new ApiError(
                `API key ${keyIndex + 1}/${totalKeys} for ${provider} is rate limited`,
                'rate_limit_error',
                'rate_limited',
                429,
                {
                    provider,
                    lastError: error.message,
                    timestamp: new Date().toISOString()
                }
            );
        }
        
        return new ApiError(
            `API key ${keyIndex + 1}/${totalKeys} for ${provider} failed: ${error.message}`,
            'authentication_error',
            'invalid_api_key',
            401,
            {
                provider,
                lastError: error.message,
                timestamp: new Date().toISOString()
            }
        );
    }
    
    /**
     * Get detailed key status information for error responses
     */
    static getKeyStatusDetails(llmManager: LlmManager, provider: Provider): ErrorDetails {
        const keyStatuses = llmManager.apiKeyStatus[provider] || [];
        
        return {
            provider,
            keyStatuses,
            timestamp: new Date().toISOString()
        };
    }
}

/**
 * Error response formatting utilities
 */
export class ErrorResponseFormatter {
    /**
     * Format an ApiError into an HTTP response object
     */
    static formatHttpResponse(error: ApiError): { statusCode: number; body: ErrorResponse } {
        return {
            statusCode: error.statusCode,
            body: error.toResponse()
        };
    }
    
    /**
     * Format multiple errors into a single response
     */
    static formatMultipleErrors(errors: ApiError[]): { statusCode: number; body: ErrorResponse } {
        if (errors.length === 0) {
            return this.formatHttpResponse(new ApiError(
                'Unknown error occurred',
                'server_error',
                'internal_error',
                500
            ));
        }
        
        if (errors.length === 1) {
            return this.formatHttpResponse(errors[0]);
        }
        
        // For multiple errors, use the highest status code and combine messages
        const highestStatusCode = Math.max(...errors.map(e => e.statusCode));
        const primaryError = errors.find(e => e.statusCode === highestStatusCode) || errors[0];
        
        const combinedMessage = errors.map(e => e.message).join('; ');
        const combinedError = new ApiError(
            combinedMessage,
            primaryError.type,
            primaryError.code,
            highestStatusCode,
            {
                ...primaryError.details,
                timestamp: new Date().toISOString()
            }
        );
        
        return this.formatHttpResponse(combinedError);
    }
    
    /**
     * Create a safe error response that doesn't expose sensitive information
     */
    static createSafeErrorResponse(error: ApiError, includeDetails: boolean = false): ErrorResponse {
        const response = error.toResponse();
        
        if (!includeDetails && response.error.details) {
            // Remove sensitive details in production
            const safeDetails: ErrorDetails = {
                timestamp: response.error.details.timestamp,
                requestId: response.error.details.requestId
            };
            
            // Only include provider if it's not sensitive
            if (response.error.details.provider) {
                safeDetails.provider = response.error.details.provider;
            }
            
            response.error.details = safeDetails;
        }
        
        return response;
    }
    
    /**
     * Log error details for debugging while returning safe response to client
     */
    static logAndFormatError(
        error: ApiError, 
        requestId?: string,
        includeDetailsInResponse: boolean = false
    ): ErrorResponse {
        // Log full error details for debugging
        console.error(`[${requestId || 'unknown'}] API Error:`, {
            message: error.message,
            type: error.type,
            code: error.code,
            statusCode: error.statusCode,
            details: error.details,
            stack: error.stack
        });
        
        // Return safe response to client
        return this.createSafeErrorResponse(error, includeDetailsInResponse);
    }
}

/**
 * Request validation error utilities
 */
export class ValidationErrorHandler {
    /**
     * Validate required fields in request
     */
    static validateRequiredFields(
        data: Record<string, any>, 
        requiredFields: string[]
    ): ApiError | null {
        const missingFields: string[] = [];
        const fieldErrors: Record<string, string> = {};
        
        for (const field of requiredFields) {
            if (data[field] === undefined || data[field] === null || data[field] === '') {
                missingFields.push(field);
                fieldErrors[field] = `Field '${field}' is required`;
            }
        }
        
        if (missingFields.length > 0) {
            return ApiError.validation(
                `Missing required fields: ${missingFields.join(', ')}`,
                fieldErrors
            );
        }
        
        return null;
    }
    
    /**
     * Validate model name format
     */
    static validateModel(model: string): ApiError | null {
        if (!model || typeof model !== 'string') {
            return ApiError.validation('Model must be a non-empty string', {
                model: 'Model is required and must be a string'
            });
        }
        
        if (model.length > 100) {
            return ApiError.validation('Model name is too long', {
                model: 'Model name must be less than 100 characters'
            });
        }
        
        return null;
    }
    
    /**
     * Validate temperature parameter
     */
    static validateTemperature(temperature?: number): ApiError | null {
        if (temperature !== undefined) {
            if (typeof temperature !== 'number' || isNaN(temperature)) {
                return ApiError.validation('Temperature must be a number', {
                    temperature: 'Temperature must be a valid number'
                });
            }
            
            if (temperature < 0 || temperature > 2) {
                return ApiError.validation('Temperature must be between 0 and 2', {
                    temperature: 'Temperature must be between 0 and 2'
                });
            }
        }
        
        return null;
    }
    
    /**
     * Validate max_tokens parameter
     */
    static validateMaxTokens(maxTokens?: number): ApiError | null {
        if (maxTokens !== undefined) {
            if (typeof maxTokens !== 'number' || isNaN(maxTokens) || !Number.isInteger(maxTokens)) {
                return ApiError.validation('max_tokens must be an integer', {
                    max_tokens: 'max_tokens must be a valid integer'
                });
            }
            
            if (maxTokens < 1 || maxTokens > 32000) {
                return ApiError.validation('max_tokens must be between 1 and 32000', {
                    max_tokens: 'max_tokens must be between 1 and 32000'
                });
            }
        }
        
        return null;
    }
    
    /**
     * Validate top_p parameter
     */
    static validateTopP(topP?: number): ApiError | null {
        if (topP !== undefined) {
            if (typeof topP !== 'number' || isNaN(topP)) {
                return ApiError.validation('top_p must be a number', {
                    top_p: 'top_p must be a valid number'
                });
            }
            
            if (topP < 0 || topP > 1) {
                return ApiError.validation('top_p must be between 0 and 1', {
                    top_p: 'top_p must be between 0 and 1'
                });
            }
        }
        
        return null;
    }
    
    /**
     * Validate messages array
     */
    static validateMessages(messages: any[]): ApiError | null {
        if (!Array.isArray(messages)) {
            return ApiError.validation('Messages must be an array', {
                messages: 'Messages must be an array'
            });
        }
        
        if (messages.length === 0) {
            return ApiError.validation('Messages array cannot be empty', {
                messages: 'At least one message is required'
            });
        }
        
        const fieldErrors: Record<string, string> = {};
        
        for (let i = 0; i < messages.length; i++) {
            const message = messages[i];
            
            if (!message.role || !['user', 'assistant', 'system'].includes(message.role)) {
                fieldErrors[`messages[${i}].role`] = 'Role must be one of: user, assistant, system';
            }
            
            if (!message.content || typeof message.content !== 'string') {
                fieldErrors[`messages[${i}].content`] = 'Content must be a non-empty string';
            }
        }
        
        if (Object.keys(fieldErrors).length > 0) {
            return ApiError.validation('Invalid messages format', fieldErrors);
        }
        
        return null;
    }
}

/**
 * Utility function to safely extract error message from unknown error types
 */
export function extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    
    if (typeof error === 'string') {
        return error;
    }
    
    if (error && typeof error === 'object' && 'message' in error) {
        return String((error as any).message);
    }
    
    return 'Unknown error occurred';
}

/**
 * Utility function to determine if an error is retryable
 */
export function isRetryableError(error: ApiError): boolean {
    // Rate limit errors are retryable after some time
    if (error.type === 'rate_limit_error') {
        return true;
    }
    
    // Timeout errors are retryable
    if (error.code === 'timeout_error') {
        return true;
    }
    
    // Some server errors might be retryable
    if (error.type === 'server_error' && error.statusCode >= 500) {
        return true;
    }
    
    return false;
}

/**
 * Utility function to get retry delay for retryable errors
 */
export function getRetryDelay(error: ApiError, attempt: number): number {
    if (error.type === 'rate_limit_error') {
        // Exponential backoff for rate limits, starting at 1 second
        return Math.min(1000 * Math.pow(2, attempt), 60000); // Max 1 minute
    }
    
    if (error.code === 'timeout_error') {
        // Linear backoff for timeouts
        return Math.min(5000 + (attempt * 2000), 30000); // Max 30 seconds
    }
    
    // Default exponential backoff
    return Math.min(1000 * Math.pow(2, attempt), 30000); // Max 30 seconds
}