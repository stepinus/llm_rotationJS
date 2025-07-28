/**
 * @file errors.ts
 * @description Error handling utilities for the LLM Rotation Server
 * Provides error transformation utilities, key rotation specific error handling,
 * and error response formatting functions
 */
import { ApiError, ErrorResponse, ErrorDetails } from './types';
import { Provider } from './llm_rotation';
import LlmManager from './llm_rotation';
/**
 * Transform generic errors into structured ApiError instances
 */
export declare class ErrorTransformer {
    /**
     * Transform a generic error into an ApiError with appropriate type and code
     */
    static fromGenericError(error: Error, context?: {
        provider?: string;
        model?: string;
    }): ApiError;
    /**
     * Transform validation errors into structured ApiError
     */
    static fromValidationError(message: string, fieldErrors?: Record<string, string>): ApiError;
    /**
     * Transform provider-specific errors into ApiError
     */
    static fromProviderError(error: Error, provider: string): ApiError;
}
/**
 * Key rotation specific error handling utilities
 */
export declare class KeyRotationErrorHandler {
    /**
     * Handle key exhaustion errors with detailed status information
     */
    static handleKeyExhaustion(provider: Provider, error: Error, llmManager: LlmManager): ApiError;
    /**
     * Handle individual key failures
     */
    static handleKeyFailure(provider: Provider, keyIndex: number, error: Error, totalKeys: number): ApiError;
    /**
     * Get detailed key status information for error responses
     */
    static getKeyStatusDetails(llmManager: LlmManager, provider: Provider): ErrorDetails;
}
/**
 * Error response formatting utilities
 */
export declare class ErrorResponseFormatter {
    /**
     * Format an ApiError into an HTTP response object
     */
    static formatHttpResponse(error: ApiError): {
        statusCode: number;
        body: ErrorResponse;
    };
    /**
     * Format multiple errors into a single response
     */
    static formatMultipleErrors(errors: ApiError[]): {
        statusCode: number;
        body: ErrorResponse;
    };
    /**
     * Create a safe error response that doesn't expose sensitive information
     */
    static createSafeErrorResponse(error: ApiError, includeDetails?: boolean): ErrorResponse;
    /**
     * Log error details for debugging while returning safe response to client
     */
    static logAndFormatError(error: ApiError, requestId?: string, includeDetailsInResponse?: boolean): ErrorResponse;
}
/**
 * Request validation error utilities
 */
export declare class ValidationErrorHandler {
    /**
     * Validate required fields in request
     */
    static validateRequiredFields(data: Record<string, any>, requiredFields: string[]): ApiError | null;
    /**
     * Validate model name format
     */
    static validateModel(model: string): ApiError | null;
    /**
     * Validate temperature parameter
     */
    static validateTemperature(temperature?: number): ApiError | null;
    /**
     * Validate max_tokens parameter
     */
    static validateMaxTokens(maxTokens?: number): ApiError | null;
    /**
     * Validate top_p parameter
     */
    static validateTopP(topP?: number): ApiError | null;
    /**
     * Validate messages array
     */
    static validateMessages(messages: any[]): ApiError | null;
}
/**
 * Utility function to safely extract error message from unknown error types
 */
export declare function extractErrorMessage(error: unknown): string;
/**
 * Utility function to determine if an error is retryable
 */
export declare function isRetryableError(error: ApiError): boolean;
/**
 * Utility function to get retry delay for retryable errors
 */
export declare function getRetryDelay(error: ApiError, attempt: number): number;
//# sourceMappingURL=errors.d.ts.map