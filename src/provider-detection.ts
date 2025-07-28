/**
 * @file provider-detection.ts
 * @description Provider detection module for automatically determining the correct
 * LLM provider based on model names. Includes exact matching against known
 * configurations and pattern-based fallback logic.
 */

import { LlmManager } from './llm_rotation';
import type { Provider, ProviderDetectionResult } from './types';

/**
 * Determines the appropriate provider for a given model name
 * @param model - The model identifier to detect provider for
 * @returns The detected provider or null if unsupported
 */
export function determineProvider(model: string): Provider | null {
    const result = determineProviderWithDetails(model);
    return result.provider;
}

/**
 * Determines the appropriate provider with detailed detection information
 * @param model - The model identifier to detect provider for
 * @returns Detailed provider detection result including confidence and reason
 */
export function determineProviderWithDetails(model: string): ProviderDetectionResult {
    if (!model || typeof model !== 'string') {
        return {
            provider: null,
            confidence: 0,
            reason: 'unknown',
            alternatives: []
        };
    }

    // Normalize model name for comparison
    const normalizedModel = model.trim().toLowerCase();

    // 1. Check LlmManager.modelConfigurations for exact match
    const exactMatch = findExactMatch(model);
    if (exactMatch) {
        return {
            provider: exactMatch,
            confidence: 1.0,
            reason: 'exact_match',
            alternatives: []
        };
    }

    // 2. Pattern-based fallback detection
    const patternMatch = findPatternMatch(normalizedModel);
    if (patternMatch.provider) {
        return patternMatch;
    }

    // 3. No match found
    return {
        provider: null,
        confidence: 0,
        reason: 'unknown',
        alternatives: []
    };
}

/**
 * Finds exact match in LlmManager.modelConfigurations
 * @param model - The exact model identifier
 * @returns The provider if found, null otherwise
 */
function findExactMatch(model: string): Provider | null {
    for (const [provider, models] of Object.entries(LlmManager.modelConfigurations)) {
        if (models.some(m => m.id === model)) {
            return provider as Provider;
        }
    }
    return null;
}

/**
 * Finds provider using pattern matching
 * @param normalizedModel - The normalized (lowercase, trimmed) model name
 * @returns Provider detection result with pattern matching details
 */
function findPatternMatch(normalizedModel: string): ProviderDetectionResult {
    const patterns: Array<{
        provider: Provider;
        patterns: string[];
        confidence: number;
        alternatives?: Provider[];
    }> = [
        {
            provider: 'gemini',
            patterns: ['gemini', 'google', 'bard', 'learnlm'],
            confidence: 0.9,
            alternatives: []
        },
        {
            provider: 'chutes',
            patterns: ['deepseek-r1', 'deepseek-v3', 'deepseek', 'arli', 'microsoft/mai', 'tngtech', 'tencent/hunyuan', 'qwen3', 'chutesai', 'minimax', 'mrfakename', 'moonshotai/kimi'],
            confidence: 0.85,
            alternatives: ['openrouter', 'nvidia']
        },
        {
            provider: 'openrouter',
            patterns: ['gpt', 'openai', 'claude', 'anthropic', 'mai-ds', 'qwq', 'deepseek-chat', 'hunyuan', 'reka', 'moonlight', 'dolphin'],
            confidence: 0.8,
            alternatives: ['chutes', 'nvidia']
        },
        {
            provider: 'nvidia',
            patterns: ['nvidia', 'nemotron', 'meta/llama-4', 'writer/palmyra', 'qwen/qwq', 'meta/llama-3.3', '01-ai/yi', 'mistralai/mixtral', 'deepseek-ai/deepseek-r1', 'qwen/qwen3'],
            confidence: 0.85,
            alternatives: ['chutes', 'openrouter']
        },
        {
            provider: 'huggingface',
            patterns: ['meta-llama', 'llama', 'alpindale', 'cognitivecomputations', 'huggingfaceh4', 'zephyr', 'sao10k'],
            confidence: 0.7,
            alternatives: ['openrouter', 'nvidia']
        },
        {
            provider: 'mistral',
            patterns: ['mistral-large', 'mistral-medium', 'mistral-small', 'magistral', 'open-mistral'],
            confidence: 0.9,
            alternatives: []
        },
        {
            provider: 'cohere',
            patterns: ['command-a', 'command-r', 'command-nightly'],
            confidence: 0.9,
            alternatives: []
        },
        {
            provider: 'requesty',
            patterns: ['requesty'],
            confidence: 0.8,
            alternatives: ['openrouter']
        }
    ];

    // Find the best matching pattern
    let bestMatch: ProviderDetectionResult = {
        provider: null,
        confidence: 0,
        reason: 'unknown',
        alternatives: []
    };

    for (const patternGroup of patterns) {
        for (const pattern of patternGroup.patterns) {
            if (normalizedModel.includes(pattern)) {
                if (patternGroup.confidence > bestMatch.confidence) {
                    bestMatch = {
                        provider: patternGroup.provider,
                        confidence: patternGroup.confidence,
                        reason: 'pattern_match',
                        alternatives: patternGroup.alternatives || []
                    };
                }
            }
        }
    }

    return bestMatch;
}

/**
 * Validates if a model is supported by checking against known configurations
 * @param model - The model identifier to validate
 * @returns True if the model is supported, false otherwise
 */
export function validateModel(model: string): boolean {
    if (!model || typeof model !== 'string') {
        return false;
    }

    // Check if model exists in any provider's configuration
    const provider = findExactMatch(model);
    if (provider) {
        return true;
    }

    // Check if we can detect a provider through pattern matching
    const patternResult = findPatternMatch(model.toLowerCase());
    return patternResult.provider !== null && patternResult.confidence > 0.5;
}

/**
 * Gets all supported models for a specific provider
 * @param provider - The provider to get models for
 * @returns Array of model configurations for the provider
 */
export function getModelsForProvider(provider: Provider): Array<{ id: string; name: string; free?: boolean }> {
    const models = LlmManager.modelConfigurations[provider];
    return models || [];
}

/**
 * Gets all available providers
 * @returns Array of all supported provider names
 */
export function getAllProviders(): Provider[] {
    return Object.keys(LlmManager.modelConfigurations) as Provider[];
}

/**
 * Gets alternative providers that might support a model
 * @param model - The model identifier
 * @returns Array of alternative providers that might work
 */
export function getAlternativeProviders(model: string): Provider[] {
    const result = determineProviderWithDetails(model);
    return result.alternatives || [];
}

/**
 * Checks if a specific provider supports a model
 * @param provider - The provider to check
 * @param model - The model identifier
 * @returns True if the provider supports the model
 */
export function providerSupportsModel(provider: Provider, model: string): boolean {
    const models = LlmManager.modelConfigurations[provider];
    if (!models) {
        return false;
    }
    
    return models.some(m => m.id === model);
}