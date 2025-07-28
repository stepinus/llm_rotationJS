/**
 * @file provider-detection.ts
 * @description Provider detection module for automatically determining the correct
 * LLM provider based on model names. Includes exact matching against known
 * configurations and pattern-based fallback logic.
 */
import type { Provider, ProviderDetectionResult } from './types';
/**
 * Determines the appropriate provider for a given model name
 * @param model - The model identifier to detect provider for
 * @returns The detected provider or null if unsupported
 */
export declare function determineProvider(model: string): Provider | null;
/**
 * Determines the appropriate provider with detailed detection information
 * @param model - The model identifier to detect provider for
 * @returns Detailed provider detection result including confidence and reason
 */
export declare function determineProviderWithDetails(model: string): ProviderDetectionResult;
/**
 * Validates if a model is supported by checking against known configurations
 * @param model - The model identifier to validate
 * @returns True if the model is supported, false otherwise
 */
export declare function validateModel(model: string): boolean;
/**
 * Gets all supported models for a specific provider
 * @param provider - The provider to get models for
 * @returns Array of model configurations for the provider
 */
export declare function getModelsForProvider(provider: Provider): Array<{
    id: string;
    name: string;
    free?: boolean;
}>;
/**
 * Gets all available providers
 * @returns Array of all supported provider names
 */
export declare function getAllProviders(): Provider[];
/**
 * Gets alternative providers that might support a model
 * @param model - The model identifier
 * @returns Array of alternative providers that might work
 */
export declare function getAlternativeProviders(model: string): Provider[];
/**
 * Checks if a specific provider supports a model
 * @param provider - The provider to check
 * @param model - The model identifier
 * @returns True if the provider supports the model
 */
export declare function providerSupportsModel(provider: Provider, model: string): boolean;
//# sourceMappingURL=provider-detection.d.ts.map