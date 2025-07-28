"use strict";
/**
 * @file error-handling-examples.ts
 * @description Examples demonstrating the error handling system
 * This file shows how to use the error handling utilities in practice
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exampleBasicErrorTransformation = exampleBasicErrorTransformation;
exports.exampleValidationErrors = exampleValidationErrors;
exports.exampleKeyRotationErrors = exampleKeyRotationErrors;
exports.exampleSafeErrorHandling = exampleSafeErrorHandling;
exports.exampleRetryLogic = exampleRetryLogic;
exports.exampleProviderErrors = exampleProviderErrors;
exports.exampleErrorMessageExtraction = exampleErrorMessageExtraction;
exports.runAllExamples = runAllExamples;
const errors_1 = require("./errors");
const types_1 = require("./types");
const llm_rotation_1 = __importDefault(require("./llm_rotation"));
/**
 * Example: Basic error transformation
 */
function exampleBasicErrorTransformation() {
    console.log('=== Basic Error Transformation ===');
    // Transform a generic error
    const genericError = new Error('Rate limit exceeded');
    const apiError = errors_1.ErrorTransformer.fromGenericError(genericError, { provider: 'openai' });
    console.log('Original error:', genericError.message);
    console.log('Transformed ApiError:', {
        type: apiError.type,
        code: apiError.code,
        statusCode: apiError.statusCode,
        message: apiError.message
    });
    // Format for HTTP response
    const httpResponse = errors_1.ErrorResponseFormatter.formatHttpResponse(apiError);
    console.log('HTTP Response:', JSON.stringify(httpResponse, null, 2));
}
/**
 * Example: Validation error handling
 */
function exampleValidationErrors() {
    console.log('\n=== Validation Error Handling ===');
    // Validate a chat completion request
    const invalidRequest = {
        model: '', // Invalid: empty model
        messages: [], // Invalid: empty messages
        temperature: 3.0 // Invalid: temperature > 2
    };
    const errors = [];
    // Validate model
    const modelError = errors_1.ValidationErrorHandler.validateModel(invalidRequest.model);
    if (modelError)
        errors.push(modelError);
    // Validate messages
    const messagesError = errors_1.ValidationErrorHandler.validateMessages(invalidRequest.messages);
    if (messagesError)
        errors.push(messagesError);
    // Validate temperature
    const tempError = errors_1.ValidationErrorHandler.validateTemperature(invalidRequest.temperature);
    if (tempError)
        errors.push(tempError);
    // Format multiple errors
    const response = errors_1.ErrorResponseFormatter.formatMultipleErrors(errors);
    console.log('Validation errors response:', JSON.stringify(response, null, 2));
}
/**
 * Example: Key rotation error handling
 */
function exampleKeyRotationErrors() {
    console.log('\n=== Key Rotation Error Handling ===');
    // Create a mock LlmManager with some key statuses
    const llmManager = new llm_rotation_1.default();
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
    const keyExhaustionApiError = errors_1.KeyRotationErrorHandler.handleKeyExhaustion('openrouter', exhaustionError, llmManager);
    console.log('Key exhaustion error:', JSON.stringify(keyExhaustionApiError.toResponse(), null, 2));
    // Simulate individual key failure
    const keyFailureError = new Error('Invalid API key');
    const keyFailureApiError = errors_1.KeyRotationErrorHandler.handleKeyFailure('gemini', 0, keyFailureError, 2);
    console.log('Key failure error:', JSON.stringify(keyFailureApiError.toResponse(), null, 2));
}
/**
 * Example: Safe error logging and response formatting
 */
function exampleSafeErrorHandling() {
    console.log('\n=== Safe Error Handling ===');
    // Create an error with sensitive information
    const sensitiveError = new types_1.ApiError('Provider authentication failed', 'authentication_error', 'invalid_api_key', 401, {
        provider: 'openai',
        keyStatuses: ['failed', 'working', 'rate-limited'],
        lastError: 'Invalid API key: sk-1234567890abcdef',
        timestamp: new Date().toISOString()
    });
    // Log with full details (server-side)
    console.log('Full error details (server-side):');
    const fullResponse = errors_1.ErrorResponseFormatter.logAndFormatError(sensitiveError, 'req-123', true);
    console.log(JSON.stringify(fullResponse, null, 2));
    // Safe response for client (production)
    console.log('\nSafe error response (client-side):');
    const safeResponse = errors_1.ErrorResponseFormatter.createSafeErrorResponse(sensitiveError, false);
    console.log(JSON.stringify(safeResponse, null, 2));
}
/**
 * Example: Retry logic with error handling
 */
function exampleRetryLogic() {
    console.log('\n=== Retry Logic Example ===');
    const errors = [
        new types_1.ApiError('Rate limit exceeded', 'rate_limit_error', 'rate_limited', 429),
        new types_1.ApiError('Request timeout', 'api_error', 'timeout_error', 504),
        new types_1.ApiError('Invalid model', 'invalid_request_error', 'model_not_found', 400),
        new types_1.ApiError('Server error', 'server_error', 'internal_error', 500)
    ];
    errors.forEach((error, index) => {
        const retryable = (0, errors_1.isRetryableError)(error);
        console.log(`Error ${index + 1}: ${error.message}`);
        console.log(`  Retryable: ${retryable}`);
        if (retryable) {
            console.log(`  Retry delays: ${[0, 1, 2].map(attempt => (0, errors_1.getRetryDelay)(error, attempt)).join('ms, ')}ms`);
        }
        console.log('');
    });
}
/**
 * Example: Provider-specific error handling
 */
function exampleProviderErrors() {
    console.log('\n=== Provider-Specific Error Handling ===');
    const providerErrors = [
        { error: new Error('insufficient_quota'), provider: 'openai' },
        { error: new Error('model_not_found'), provider: 'gemini' },
        { error: new Error('Connection timeout'), provider: 'huggingface' }
    ];
    providerErrors.forEach(({ error, provider }) => {
        const apiError = errors_1.ErrorTransformer.fromProviderError(error, provider);
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
function exampleErrorMessageExtraction() {
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
        const message = (0, errors_1.extractErrorMessage)(error);
        console.log(`Error ${index + 1} (${typeof error}):`, message);
    });
}
/**
 * Run all examples
 */
function runAllExamples() {
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
//# sourceMappingURL=error-handling-examples.js.map