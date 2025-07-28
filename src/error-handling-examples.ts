/**
 * @file error-handling-examples.ts
 * @description Examples demonstrating the error handling system
 * This file shows how to use the error handling utilities in practice
 */

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

/**
 * Example: Basic error transformation
 */
export function exampleBasicErrorTransformation() {
    console.log('=== Basic Error Transformation ===');
    
    // Transform a generic error
    const genericError = new Error('Rate limit exceeded');
    const apiError = ErrorTransformer.fromGenericError(genericError, { provider: 'openai' });
    
    console.log('Original error:', genericError.message);
    console.log('Transformed ApiError:', {
        type: apiError.type,
        code: apiError.code,
        statusCode: apiError.statusCode,
        message: apiError.message
    });
    
    // Format for HTTP response
    const httpResponse = ErrorResponseFormatter.formatHttpResponse(apiError);
    console.log('HTTP Response:', JSON.stringify(httpResponse, null, 2));
}

/**
 * Example: Validation error handling
 */
export function exampleValidationErrors() {
    console.log('\n=== Validation Error Handling ===');
    
    // Validate a chat completion request
    const invalidRequest = {
        model: '', // Invalid: empty model
        messages: [], // Invalid: empty messages
        temperature: 3.0 // Invalid: temperature > 2
    };
    
    const errors: ApiError[] = [];
    
    // Validate model
    const modelError = ValidationErrorHandler.validateModel(invalidRequest.model);
    if (modelError) errors.push(modelError);
    
    // Validate messages
    const messagesError = ValidationErrorHandler.validateMessages(invalidRequest.messages);
    if (messagesError) errors.push(messagesError);
    
    // Validate temperature
    const tempError = ValidationErrorHandler.validateTemperature(invalidRequest.temperature);
    if (tempError) errors.push(tempError);
    
    // Format multiple errors
    const response = ErrorResponseFormatter.formatMultipleErrors(errors);
    console.log('Validation errors response:', JSON.stringify(response, null, 2));
}

/**
 * Example: Key rotation error handling
 */
export function exampleKeyRotationErrors() {
    console.log('\n=== Key Rotation Error Handling ===');
    
    // Create a mock LlmManager with some key statuses
    const llmManager = new LlmManager();
    llmManager.apiKeyStatus = {
        openrouter: ['failed', 'rate-limited', 'working'],
        gemini: ['failed', 'failed'],
        huggingface: [],
        mistral: [],
        cohere: [],
        nvidia: [],
        chutes: [],
        requesty: []
    };
    
    // Simulate key exhaustion
    const exhaustionError = new Error('All openrouter API keys failed');
    const keyExhaustionApiError = KeyRotationErrorHandler.handleKeyExhaustion(
        'openrouter', 
        exhaustionError, 
        llmManager
    );
    
    console.log('Key exhaustion error:', JSON.stringify(keyExhaustionApiError.toResponse(), null, 2));
    
    // Simulate individual key failure
    const keyFailureError = new Error('Invalid API key');
    const keyFailureApiError = KeyRotationErrorHandler.handleKeyFailure(
        'gemini', 
        0, 
        keyFailureError, 
        2
    );
    
    console.log('Key failure error:', JSON.stringify(keyFailureApiError.toResponse(), null, 2));
}

/**
 * Example: Safe error logging and response formatting
 */
export function exampleSafeErrorHandling() {
    console.log('\n=== Safe Error Handling ===');
    
    // Create an error with sensitive information
    const sensitiveError = new ApiError(
        'Provider authentication failed',
        'authentication_error',
        'invalid_api_key',
        401,
        {
            provider: 'openai',
            keyStatuses: ['failed', 'working', 'rate-limited'],
            lastError: 'Invalid API key: sk-1234567890abcdef',
            timestamp: new Date().toISOString()
        }
    );
    
    // Log with full details (server-side)
    console.log('Full error details (server-side):');
    const fullResponse = ErrorResponseFormatter.logAndFormatError(sensitiveError, 'req-123', true);
    console.log(JSON.stringify(fullResponse, null, 2));
    
    // Safe response for client (production)
    console.log('\nSafe error response (client-side):');
    const safeResponse = ErrorResponseFormatter.createSafeErrorResponse(sensitiveError, false);
    console.log(JSON.stringify(safeResponse, null, 2));
}

/**
 * Example: Retry logic with error handling
 */
export function exampleRetryLogic() {
    console.log('\n=== Retry Logic Example ===');
    
    const errors = [
        new ApiError('Rate limit exceeded', 'rate_limit_error', 'rate_limited', 429),
        new ApiError('Request timeout', 'api_error', 'timeout_error', 504),
        new ApiError('Invalid model', 'invalid_request_error', 'model_not_found', 400),
        new ApiError('Server error', 'server_error', 'internal_error', 500)
    ];
    
    errors.forEach((error, index) => {
        const retryable = isRetryableError(error);
        console.log(`Error ${index + 1}: ${error.message}`);
        console.log(`  Retryable: ${retryable}`);
        
        if (retryable) {
            console.log(`  Retry delays: ${[0, 1, 2].map(attempt => getRetryDelay(error, attempt)).join('ms, ')}ms`);
        }
        console.log('');
    });
}

/**
 * Example: Provider-specific error handling
 */
export function exampleProviderErrors() {
    console.log('\n=== Provider-Specific Error Handling ===');
    
    const providerErrors = [
        { error: new Error('insufficient_quota'), provider: 'openai' },
        { error: new Error('model_not_found'), provider: 'gemini' },
        { error: new Error('Connection timeout'), provider: 'huggingface' }
    ];
    
    providerErrors.forEach(({ error, provider }) => {
        const apiError = ErrorTransformer.fromProviderError(error, provider);
        console.log(`${provider} error:`, {
            type: apiError.type,
            code: apiError.code,
            statusCode: apiError.statusCode,
            message: apiError.message
        });
    });
}

/**
 * Example: Error message extraction from various error types
 */
export function exampleErrorMessageExtraction() {
    console.log('\n=== Error Message Extraction ===');
    
    const errorTypes = [
        new Error('Standard Error object'),
        'String error message',
        { message: 'Object with message property' },
        { error: 'Object with error property' },
        null,
        undefined,
        123,
        { someOtherProperty: 'value' }
    ];
    
    errorTypes.forEach((error, index) => {
        const message = extractErrorMessage(error);
        console.log(`Error ${index + 1} (${typeof error}):`, message);
    });
}

/**
 * Run all examples
 */
export function runAllExamples() {
    console.log('🚀 Error Handling System Examples\n');
    
    exampleBasicErrorTransformation();
    exampleValidationErrors();
    exampleKeyRotationErrors();
    exampleSafeErrorHandling();
    exampleRetryLogic();
    exampleProviderErrors();
    exampleErrorMessageExtraction();
    
    console.log('\n✅ All examples completed!');
}

// Uncomment to run examples
// runAllExamples();