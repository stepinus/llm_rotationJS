/**
 * @file errors.test.ts
 * @description Unit tests for error handling utilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    ErrorTransformer,
    KeyRotationErrorHandler,
    ErrorResponseFormatter,
    ValidationErrorHandler,
    extractErrorMessage,
    isRetryableError,
    getRetryDelay
} from './errors';
import { ApiError } from './types';
import LlmManager from './llm_rotation';

describe('ErrorTransformer', () => {
    describe('fromGenericError', () => {
        it('should transform rate limit errors correctly', () => {
            const error = new Error('Rate limit exceeded');
            const apiError = ErrorTransformer.fromGenericError(error, { provider: 'openai' });
            
            expect(apiError.type).toBe('rate_limit_error');
            expect(apiError.code).toBe('rate_limited');
            expect(apiError.statusCode).toBe(429);
            expect(apiError.details?.provider).toBe('openai');
        });
        
        it('should transform authentication errors correctly', () => {
            const error = new Error('401 unauthorized');
            const apiError = ErrorTransformer.fromGenericError(error, { provider: 'gemini' });
            
            expect(apiError.type).toBe('authentication_error');
            expect(apiError.code).toBe('invalid_api_key');
            expect(apiError.statusCode).toBe(401);
            expect(apiError.details?.provider).toBe('gemini');
        });
        
        it('should transform timeout errors correctly', () => {
            const error = new Error('Request timeout ETIMEDOUT');
            const apiError = ErrorTransformer.fromGenericError(error, { provider: 'huggingface' });
            
            expect(apiError.type).toBe('api_error');
            expect(apiError.code).toBe('timeout_error');
            expect(apiError.statusCode).toBe(504);
            expect(apiError.details?.provider).toBe('huggingface');
        });
        
        it('should transform model not found errors correctly', () => {
            const error = new Error('model not found');
            const apiError = ErrorTransformer.fromGenericError(error, { model: 'gpt-4' });
            
            expect(apiError.type).toBe('invalid_request_error');
            expect(apiError.code).toBe('model_not_found');
            expect(apiError.statusCode).toBe(400);
        });
        
        it('should transform key exhaustion errors correctly', () => {
            const error = new Error('All openai API keys failed');
            const apiError = ErrorTransformer.fromGenericError(error, { provider: 'openai' });
            
            expect(apiError.type).toBe('api_error');
            expect(apiError.code).toBe('keys_exhausted');
            expect(apiError.statusCode).toBe(502);
            expect(apiError.details?.provider).toBe('openai');
        });
        
        it('should default to server error for unknown errors', () => {
            const error = new Error('Something went wrong');
            const apiError = ErrorTransformer.fromGenericError(error);
            
            expect(apiError.type).toBe('server_error');
            expect(apiError.code).toBe('internal_error');
            expect(apiError.statusCode).toBe(500);
        });
    });
    
    describe('fromValidationError', () => {
        it('should create validation error with field errors', () => {
            const fieldErrors = { model: 'Model is required' };
            const apiError = ErrorTransformer.fromValidationError('Validation failed', fieldErrors);
            
            expect(apiError.type).toBe('invalid_request_error');
            expect(apiError.code).toBe('validation_failed');
            expect(apiError.statusCode).toBe(400);
            expect(apiError.details?.fieldErrors).toEqual(fieldErrors);
        });
    });
    
    describe('fromProviderError', () => {
        it('should transform quota errors correctly', () => {
            const error = new Error('insufficient_quota');
            const apiError = ErrorTransformer.fromProviderError(error, 'openai');
            
            expect(apiError.type).toBe('api_error');
            expect(apiError.code).toBe('insufficient_quota');
            expect(apiError.statusCode).toBe(429);
            expect(apiError.details?.provider).toBe('openai');
        });
        
        it('should transform model not found errors correctly', () => {
            const error = new Error('model_not_found');
            const apiError = ErrorTransformer.fromProviderError(error, 'gemini');
            
            expect(apiError.type).toBe('invalid_request_error');
            expect(apiError.code).toBe('model_not_found');
            expect(apiError.statusCode).toBe(400);
            expect(apiError.details?.provider).toBe('gemini');
        });
        
        it('should default to provider error for unknown errors', () => {
            const error = new Error('Unknown provider error');
            const apiError = ErrorTransformer.fromProviderError(error, 'mistral');
            
            expect(apiError.type).toBe('api_error');
            expect(apiError.code).toBe('provider_error');
            expect(apiError.statusCode).toBe(502);
            expect(apiError.details?.provider).toBe('mistral');
        });
    });
});

describe('KeyRotationErrorHandler', () => {
    let mockLlmManager: LlmManager;
    
    beforeEach(() => {
        mockLlmManager = new LlmManager();
        mockLlmManager.apiKeyStatus = {
            gemini: ['working', 'failed', 'rate-limited'],
            openrouter: ['failed', 'failed'],
            huggingface: [],
            mistral: [],
            cohere: [],
            nvidia: [],
            chutes: [],
            requesty: []
        };
    });
    
    describe('handleKeyExhaustion', () => {
        it('should create key exhaustion error with status details', () => {
            const error = new Error('All keys failed');
            const apiError = KeyRotationErrorHandler.handleKeyExhaustion('gemini', error, mockLlmManager);
            
            expect(apiError.type).toBe('api_error');
            expect(apiError.code).toBe('keys_exhausted');
            expect(apiError.statusCode).toBe(502);
            expect(apiError.details?.provider).toBe('gemini');
            expect(apiError.details?.keyStatuses).toEqual(['working', 'failed', 'rate-limited']);
            expect(apiError.details?.lastError).toBe('All keys failed');
        });
    });
    
    describe('handleKeyFailure', () => {
        it('should handle rate limit errors correctly', () => {
            const error = new Error('Rate limit exceeded');
            const apiError = KeyRotationErrorHandler.handleKeyFailure('openai', 0, error, 3);
            
            expect(apiError.type).toBe('rate_limit_error');
            expect(apiError.code).toBe('rate_limited');
            expect(apiError.statusCode).toBe(429);
            expect(apiError.message).toContain('API key 1/3');
        });
        
        it('should handle authentication errors correctly', () => {
            const error = new Error('Invalid API key');
            const apiError = KeyRotationErrorHandler.handleKeyFailure('openai', 1, error, 3);
            
            expect(apiError.type).toBe('authentication_error');
            expect(apiError.code).toBe('invalid_api_key');
            expect(apiError.statusCode).toBe(401);
            expect(apiError.message).toContain('API key 2/3');
        });
    });
    
    describe('getKeyStatusDetails', () => {
        it('should return key status details', () => {
            const details = KeyRotationErrorHandler.getKeyStatusDetails(mockLlmManager, 'gemini');
            
            expect(details.provider).toBe('gemini');
            expect(details.keyStatuses).toEqual(['working', 'failed', 'rate-limited']);
            expect(details.timestamp).toBeDefined();
        });
    });
});

describe('ErrorResponseFormatter', () => {
    describe('formatHttpResponse', () => {
        it('should format ApiError into HTTP response', () => {
            const apiError = new ApiError('Test error', 'api_error', 'provider_error', 502);
            const response = ErrorResponseFormatter.formatHttpResponse(apiError);
            
            expect(response.statusCode).toBe(502);
            expect(response.body.error.message).toBe('Test error');
            expect(response.body.error.type).toBe('api_error');
            expect(response.body.error.code).toBe('provider_error');
        });
    });
    
    describe('formatMultipleErrors', () => {
        it('should format single error correctly', () => {
            const errors = [new ApiError('Test error', 'api_error', 'provider_error', 502)];
            const response = ErrorResponseFormatter.formatMultipleErrors(errors);
            
            expect(response.statusCode).toBe(502);
            expect(response.body.error.message).toBe('Test error');
        });
        
        it('should combine multiple errors with highest status code', () => {
            const errors = [
                new ApiError('Error 1', 'api_error', 'provider_error', 400),
                new ApiError('Error 2', 'server_error', 'internal_error', 500),
                new ApiError('Error 3', 'api_error', 'timeout_error', 504)
            ];
            const response = ErrorResponseFormatter.formatMultipleErrors(errors);
            
            expect(response.statusCode).toBe(504);
            expect(response.body.error.message).toBe('Error 1; Error 2; Error 3');
        });
        
        it('should handle empty errors array', () => {
            const response = ErrorResponseFormatter.formatMultipleErrors([]);
            
            expect(response.statusCode).toBe(500);
            expect(response.body.error.type).toBe('server_error');
        });
    });
    
    describe('createSafeErrorResponse', () => {
        it('should remove sensitive details when includeDetails is false', () => {
            const apiError = new ApiError(
                'Test error',
                'api_error',
                'provider_error',
                502,
                {
                    provider: 'openai',
                    keyStatuses: ['failed', 'working'],
                    lastError: 'Sensitive error message',
                    timestamp: '2023-01-01T00:00:00.000Z'
                }
            );
            
            const response = ErrorResponseFormatter.createSafeErrorResponse(apiError, false);
            
            expect(response.error.details?.provider).toBe('openai');
            expect(response.error.details?.timestamp).toBe('2023-01-01T00:00:00.000Z');
            expect(response.error.details?.keyStatuses).toBeUndefined();
            expect(response.error.details?.lastError).toBeUndefined();
        });
        
        it('should include all details when includeDetails is true', () => {
            const apiError = new ApiError(
                'Test error',
                'api_error',
                'provider_error',
                502,
                {
                    provider: 'openai',
                    keyStatuses: ['failed', 'working'],
                    lastError: 'Detailed error message',
                    timestamp: '2023-01-01T00:00:00.000Z'
                }
            );
            
            const response = ErrorResponseFormatter.createSafeErrorResponse(apiError, true);
            
            expect(response.error.details?.provider).toBe('openai');
            expect(response.error.details?.keyStatuses).toEqual(['failed', 'working']);
            expect(response.error.details?.lastError).toBe('Detailed error message');
        });
    });
    
    describe('logAndFormatError', () => {
        it('should log error and return safe response', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            
            const apiError = new ApiError('Test error', 'api_error', 'provider_error', 502);
            const response = ErrorResponseFormatter.logAndFormatError(apiError, 'req-123');
            
            expect(consoleSpy).toHaveBeenCalledWith(
                '[req-123] API Error:',
                expect.objectContaining({
                    message: 'Test error',
                    type: 'api_error',
                    code: 'provider_error',
                    statusCode: 502
                })
            );
            
            expect(response.error.message).toBe('Test error');
            
            consoleSpy.mockRestore();
        });
    });
});

describe('ValidationErrorHandler', () => {
    describe('validateRequiredFields', () => {
        it('should return null for valid data', () => {
            const data = { model: 'gpt-4', messages: [] };
            const error = ValidationErrorHandler.validateRequiredFields(data, ['model', 'messages']);
            
            expect(error).toBeNull();
        });
        
        it('should return error for missing fields', () => {
            const data = { model: 'gpt-4' };
            const error = ValidationErrorHandler.validateRequiredFields(data, ['model', 'messages']);
            
            expect(error).toBeInstanceOf(ApiError);
            expect(error?.message).toContain('Missing required fields: messages');
            expect(error?.details?.fieldErrors?.messages).toBe("Field 'messages' is required");
        });
    });
    
    describe('validateModel', () => {
        it('should return null for valid model', () => {
            const error = ValidationErrorHandler.validateModel('gpt-4');
            expect(error).toBeNull();
        });
        
        it('should return error for empty model', () => {
            const error = ValidationErrorHandler.validateModel('');
            expect(error).toBeInstanceOf(ApiError);
            expect(error?.message).toContain('non-empty string');
        });
        
        it('should return error for too long model name', () => {
            const longModel = 'a'.repeat(101);
            const error = ValidationErrorHandler.validateModel(longModel);
            expect(error).toBeInstanceOf(ApiError);
            expect(error?.message).toContain('too long');
        });
    });
    
    describe('validateTemperature', () => {
        it('should return null for valid temperature', () => {
            expect(ValidationErrorHandler.validateTemperature(0.7)).toBeNull();
            expect(ValidationErrorHandler.validateTemperature(0)).toBeNull();
            expect(ValidationErrorHandler.validateTemperature(2)).toBeNull();
            expect(ValidationErrorHandler.validateTemperature(undefined)).toBeNull();
        });
        
        it('should return error for invalid temperature', () => {
            expect(ValidationErrorHandler.validateTemperature(-0.1)).toBeInstanceOf(ApiError);
            expect(ValidationErrorHandler.validateTemperature(2.1)).toBeInstanceOf(ApiError);
            expect(ValidationErrorHandler.validateTemperature(NaN)).toBeInstanceOf(ApiError);
        });
    });
    
    describe('validateMaxTokens', () => {
        it('should return null for valid max_tokens', () => {
            expect(ValidationErrorHandler.validateMaxTokens(1000)).toBeNull();
            expect(ValidationErrorHandler.validateMaxTokens(1)).toBeNull();
            expect(ValidationErrorHandler.validateMaxTokens(32000)).toBeNull();
            expect(ValidationErrorHandler.validateMaxTokens(undefined)).toBeNull();
        });
        
        it('should return error for invalid max_tokens', () => {
            expect(ValidationErrorHandler.validateMaxTokens(0)).toBeInstanceOf(ApiError);
            expect(ValidationErrorHandler.validateMaxTokens(32001)).toBeInstanceOf(ApiError);
            expect(ValidationErrorHandler.validateMaxTokens(1.5)).toBeInstanceOf(ApiError);
            expect(ValidationErrorHandler.validateMaxTokens(NaN)).toBeInstanceOf(ApiError);
        });
    });
    
    describe('validateTopP', () => {
        it('should return null for valid top_p', () => {
            expect(ValidationErrorHandler.validateTopP(0.9)).toBeNull();
            expect(ValidationErrorHandler.validateTopP(0)).toBeNull();
            expect(ValidationErrorHandler.validateTopP(1)).toBeNull();
            expect(ValidationErrorHandler.validateTopP(undefined)).toBeNull();
        });
        
        it('should return error for invalid top_p', () => {
            expect(ValidationErrorHandler.validateTopP(-0.1)).toBeInstanceOf(ApiError);
            expect(ValidationErrorHandler.validateTopP(1.1)).toBeInstanceOf(ApiError);
            expect(ValidationErrorHandler.validateTopP(NaN)).toBeInstanceOf(ApiError);
        });
    });
    
    describe('validateMessages', () => {
        it('should return null for valid messages', () => {
            const messages = [
                { role: 'user', content: 'Hello' },
                { role: 'assistant', content: 'Hi there!' }
            ];
            const error = ValidationErrorHandler.validateMessages(messages);
            expect(error).toBeNull();
        });
        
        it('should return error for non-array messages', () => {
            const error = ValidationErrorHandler.validateMessages('not an array' as any);
            expect(error).toBeInstanceOf(ApiError);
            expect(error?.message).toContain('must be an array');
        });
        
        it('should return error for empty messages array', () => {
            const error = ValidationErrorHandler.validateMessages([]);
            expect(error).toBeInstanceOf(ApiError);
            expect(error?.message).toContain('cannot be empty');
        });
        
        it('should return error for invalid message format', () => {
            const messages = [
                { role: 'invalid', content: 'Hello' },
                { role: 'user', content: '' }
            ];
            const error = ValidationErrorHandler.validateMessages(messages);
            expect(error).toBeInstanceOf(ApiError);
            expect(error?.details?.fieldErrors?.['messages[0].role']).toContain('must be one of');
            expect(error?.details?.fieldErrors?.['messages[1].content']).toContain('non-empty string');
        });
    });
});

describe('Utility Functions', () => {
    describe('extractErrorMessage', () => {
        it('should extract message from Error object', () => {
            const error = new Error('Test error');
            expect(extractErrorMessage(error)).toBe('Test error');
        });
        
        it('should return string error as-is', () => {
            expect(extractErrorMessage('String error')).toBe('String error');
        });
        
        it('should extract message from object with message property', () => {
            const error = { message: 'Object error' };
            expect(extractErrorMessage(error)).toBe('Object error');
        });
        
        it('should return default message for unknown error types', () => {
            expect(extractErrorMessage(null)).toBe('Unknown error occurred');
            expect(extractErrorMessage(undefined)).toBe('Unknown error occurred');
            expect(extractErrorMessage(123)).toBe('Unknown error occurred');
        });
    });
    
    describe('isRetryableError', () => {
        it('should identify retryable errors', () => {
            const rateLimitError = new ApiError('Rate limited', 'rate_limit_error', 'rate_limited', 429);
            const timeoutError = new ApiError('Timeout', 'api_error', 'timeout_error', 504);
            const serverError = new ApiError('Server error', 'server_error', 'internal_error', 500);
            
            expect(isRetryableError(rateLimitError)).toBe(true);
            expect(isRetryableError(timeoutError)).toBe(true);
            expect(isRetryableError(serverError)).toBe(true);
        });
        
        it('should identify non-retryable errors', () => {
            const validationError = new ApiError('Validation failed', 'invalid_request_error', 'validation_failed', 400);
            const authError = new ApiError('Unauthorized', 'authentication_error', 'invalid_api_key', 401);
            
            expect(isRetryableError(validationError)).toBe(false);
            expect(isRetryableError(authError)).toBe(false);
        });
    });
    
    describe('getRetryDelay', () => {
        it('should calculate retry delay for rate limit errors', () => {
            const rateLimitError = new ApiError('Rate limited', 'rate_limit_error', 'rate_limited', 429);
            
            expect(getRetryDelay(rateLimitError, 0)).toBe(1000);
            expect(getRetryDelay(rateLimitError, 1)).toBe(2000);
            expect(getRetryDelay(rateLimitError, 2)).toBe(4000);
            expect(getRetryDelay(rateLimitError, 10)).toBe(60000); // Max 1 minute
        });
        
        it('should calculate retry delay for timeout errors', () => {
            const timeoutError = new ApiError('Timeout', 'api_error', 'timeout_error', 504);
            
            expect(getRetryDelay(timeoutError, 0)).toBe(5000);
            expect(getRetryDelay(timeoutError, 1)).toBe(7000);
            expect(getRetryDelay(timeoutError, 2)).toBe(9000);
            expect(getRetryDelay(timeoutError, 20)).toBe(30000); // Max 30 seconds
        });
        
        it('should calculate default retry delay for other errors', () => {
            const serverError = new ApiError('Server error', 'server_error', 'internal_error', 500);
            
            expect(getRetryDelay(serverError, 0)).toBe(1000);
            expect(getRetryDelay(serverError, 1)).toBe(2000);
            expect(getRetryDelay(serverError, 10)).toBe(30000); // Max 30 seconds
        });
    });
});