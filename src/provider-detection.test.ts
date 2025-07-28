/**
 * @file provider-detection.test.ts
 * @description Unit tests for the provider detection module
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    determineProvider,
    determineProviderWithDetails,
    validateModel,
    getModelsForProvider,
    getAllProviders,
    getAlternativeProviders,
    providerSupportsModel
} from './provider-detection';
import { LlmManager } from './llm_rotation';
import type { Provider, ProviderDetectionResult } from './types';

describe('Provider Detection Module', () => {
    describe('determineProvider', () => {
        it('should return null for empty or invalid input', () => {
            expect(determineProvider('')).toBe(null);
            expect(determineProvider('   ')).toBe(null);
            expect(determineProvider(null as any)).toBe(null);
            expect(determineProvider(undefined as any)).toBe(null);
        });

        it('should detect providers through exact match', () => {
            // Test exact matches from LlmManager.modelConfigurations
            expect(determineProvider('gemini-2.5-pro')).toBe('gemini');
            expect(determineProvider('microsoft/mai-ds-r1:free')).toBe('openrouter');
            expect(determineProvider('deepseek-ai/DeepSeek-R1')).toBe('chutes');
            expect(determineProvider('nvidia/llama-3.3-nemotron-super-49b-v1')).toBe('nvidia');
            expect(determineProvider('meta-llama/Llama-3.3-70B-Instruct')).toBe('huggingface');
            expect(determineProvider('mistral-large-latest')).toBe('mistral');
            expect(determineProvider('command-a-03-2025')).toBe('cohere');
        });

        it('should detect providers through pattern matching', () => {
            // Test pattern-based detection for models not in exact configurations
            expect(determineProvider('gemini-custom-model')).toBe('gemini');
            expect(determineProvider('gpt-4-turbo')).toBe('openrouter');
            expect(determineProvider('claude-3-opus')).toBe('openrouter');
            expect(determineProvider('llama-2-70b-chat')).toBe('huggingface');
            expect(determineProvider('deepseek-coder-v2')).toBe('chutes');
        });

        it('should return null for unsupported models', () => {
            expect(determineProvider('unknown-model-xyz')).toBe(null);
            expect(determineProvider('random-provider/random-model')).toBe(null);
            expect(determineProvider('123456789')).toBe(null);
        });

        it('should handle case insensitive matching', () => {
            expect(determineProvider('GEMINI-2.5-PRO')).toBe('gemini');
            expect(determineProvider('Gemini-Custom')).toBe('gemini');
            expect(determineProvider('GPT-4')).toBe('openrouter');
        });
    });

    describe('determineProviderWithDetails', () => {
        it('should return detailed results for exact matches', () => {
            const result = determineProviderWithDetails('gemini-2.5-pro');
            expect(result.provider).toBe('gemini');
            expect(result.confidence).toBe(1.0);
            expect(result.reason).toBe('exact_match');
            expect(result.alternatives).toEqual([]);
        });

        it('should return detailed results for pattern matches', () => {
            const result = determineProviderWithDetails('gpt-4-custom');
            expect(result.provider).toBe('openrouter');
            expect(result.confidence).toBe(0.8);
            expect(result.reason).toBe('pattern_match');
            expect(result.alternatives).toEqual(['chutes', 'nvidia']);
        });

        it('should return unknown result for unsupported models', () => {
            const result = determineProviderWithDetails('unsupported-model');
            expect(result.provider).toBe(null);
            expect(result.confidence).toBe(0);
            expect(result.reason).toBe('unknown');
            expect(result.alternatives).toEqual([]);
        });

        it('should handle invalid input gracefully', () => {
            const result = determineProviderWithDetails('');
            expect(result.provider).toBe(null);
            expect(result.confidence).toBe(0);
            expect(result.reason).toBe('unknown');
            expect(result.alternatives).toEqual([]);
        });
    });

    describe('validateModel', () => {
        it('should validate exact match models', () => {
            expect(validateModel('gemini-2.5-pro')).toBe(true);
            expect(validateModel('microsoft/mai-ds-r1:free')).toBe(true);
            expect(validateModel('deepseek-ai/DeepSeek-R1')).toBe(true);
        });

        it('should validate pattern match models with high confidence', () => {
            expect(validateModel('gemini-custom')).toBe(true);
            expect(validateModel('gpt-4-turbo')).toBe(true);
            expect(validateModel('claude-3-opus')).toBe(true);
        });

        it('should reject invalid models', () => {
            expect(validateModel('unknown-model')).toBe(false);
            expect(validateModel('')).toBe(false);
            expect(validateModel(null as any)).toBe(false);
            expect(validateModel(undefined as any)).toBe(false);
        });
    });

    describe('getModelsForProvider', () => {
        it('should return models for valid providers', () => {
            const geminiModels = getModelsForProvider('gemini');
            expect(geminiModels).toBeInstanceOf(Array);
            expect(geminiModels.length).toBeGreaterThan(0);
            expect(geminiModels[0]).toHaveProperty('id');
            expect(geminiModels[0]).toHaveProperty('name');
        });

        it('should return empty array for invalid providers', () => {
            const models = getModelsForProvider('invalid-provider' as Provider);
            expect(models).toEqual([]);
        });

        it('should return models with correct structure', () => {
            const openrouterModels = getModelsForProvider('openrouter');
            expect(openrouterModels.length).toBeGreaterThan(0);
            
            const firstModel = openrouterModels[0];
            expect(firstModel).toHaveProperty('id');
            expect(firstModel).toHaveProperty('name');
            expect(typeof firstModel.id).toBe('string');
            expect(typeof firstModel.name).toBe('string');
        });
    });

    describe('getAllProviders', () => {
        it('should return all supported providers', () => {
            const providers = getAllProviders();
            expect(providers).toBeInstanceOf(Array);
            expect(providers.length).toBeGreaterThan(0);
            
            // Check that all expected providers are included
            const expectedProviders = ['gemini', 'openrouter', 'huggingface', 'mistral', 'cohere', 'nvidia', 'chutes'];
            expectedProviders.forEach(provider => {
                expect(providers).toContain(provider);
            });
        });

        it('should return providers that match LlmManager configurations', () => {
            const providers = getAllProviders();
            const configProviders = Object.keys(LlmManager.modelConfigurations);
            
            expect(providers.sort()).toEqual(configProviders.sort());
        });
    });

    describe('getAlternativeProviders', () => {
        it('should return alternatives for pattern-matched models', () => {
            const alternatives = getAlternativeProviders('gpt-4-custom');
            expect(alternatives).toBeInstanceOf(Array);
            expect(alternatives).toContain('chutes');
            expect(alternatives).toContain('nvidia');
        });

        it('should return empty array for exact matches', () => {
            const alternatives = getAlternativeProviders('gemini-2.5-pro');
            expect(alternatives).toEqual([]);
        });

        it('should return empty array for unknown models', () => {
            const alternatives = getAlternativeProviders('unknown-model');
            expect(alternatives).toEqual([]);
        });
    });

    describe('providerSupportsModel', () => {
        it('should return true for supported model-provider combinations', () => {
            expect(providerSupportsModel('gemini', 'gemini-2.5-pro')).toBe(true);
            expect(providerSupportsModel('openrouter', 'microsoft/mai-ds-r1:free')).toBe(true);
            expect(providerSupportsModel('chutes', 'deepseek-ai/DeepSeek-R1')).toBe(true);
        });

        it('should return false for unsupported combinations', () => {
            expect(providerSupportsModel('gemini', 'gpt-4')).toBe(false);
            expect(providerSupportsModel('openrouter', 'gemini-2.5-pro')).toBe(false);
            expect(providerSupportsModel('mistral', 'claude-3-opus')).toBe(false);
        });

        it('should return false for invalid providers', () => {
            expect(providerSupportsModel('invalid-provider' as Provider, 'gemini-2.5-pro')).toBe(false);
        });
    });

    describe('Pattern Matching Logic', () => {
        it('should correctly identify Gemini models', () => {
            const geminiModels = [
                'gemini-pro',
                'gemini-1.5-flash',
                'google-gemini-custom',
                'bard-advanced',
                'learnlm-experimental'
            ];

            geminiModels.forEach(model => {
                expect(determineProvider(model)).toBe('gemini');
            });
        });

        it('should correctly identify OpenRouter models', () => {
            const openrouterModels = [
                'gpt-4-turbo',
                'gpt-3.5-turbo',
                'claude-3-opus',
                'claude-3-sonnet',
                'anthropic/claude-2',
                'openai/gpt-4'
            ];

            openrouterModels.forEach(model => {
                expect(determineProvider(model)).toBe('openrouter');
            });
        });

        it('should correctly identify Chutes models', () => {
            const chutesModels = [
                'deepseek-r1-custom',
                'deepseek-v3-beta',
                'arli-custom-model',
                'microsoft/mai-custom',
                'tngtech/custom-model'
            ];

            chutesModels.forEach(model => {
                expect(determineProvider(model)).toBe('chutes');
            });
        });

        it('should correctly identify NVIDIA models', () => {
            const nvidiaModels = [
                'nvidia/custom-model',
                'nemotron-70b',
                'meta/llama-4-custom',
                'writer/palmyra-custom'
            ];

            nvidiaModels.forEach(model => {
                expect(determineProvider(model)).toBe('nvidia');
            });
        });

        it('should correctly identify HuggingFace models', () => {
            const hfModels = [
                'meta-llama/custom-model',
                'llama-2-custom',
                'alpindale/custom-wizard',
                'zephyr-custom'
            ];

            hfModels.forEach(model => {
                expect(determineProvider(model)).toBe('huggingface');
            });
        });
    });

    describe('Edge Cases', () => {
        it('should handle models with special characters', () => {
            expect(determineProvider('gemini-2.5-pro-experimental')).toBe('gemini');
            expect(determineProvider('gpt-4-0125-preview')).toBe('openrouter');
            expect(determineProvider('claude-3-opus-20240229')).toBe('openrouter');
        });

        it('should handle very long model names', () => {
            const longModelName = 'gemini-2.5-pro-experimental-with-very-long-name-for-testing-purposes';
            expect(determineProvider(longModelName)).toBe('gemini');
        });

        it('should handle models with mixed case', () => {
            expect(determineProvider('Gemini-2.5-Pro')).toBe('gemini');
            expect(determineProvider('GPT-4-Turbo')).toBe('openrouter');
            expect(determineProvider('CLAUDE-3-OPUS')).toBe('openrouter');
        });

        it('should prioritize exact matches over pattern matches', () => {
            // This test ensures that if a model exists in exact configurations,
            // it takes precedence over pattern matching
            const exactModel = 'gemini-2.5-pro'; // This exists in exact config
            const result = determineProviderWithDetails(exactModel);
            
            expect(result.provider).toBe('gemini');
            expect(result.reason).toBe('exact_match');
            expect(result.confidence).toBe(1.0);
        });
    });
});