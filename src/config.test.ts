/**
 * @file config.test.ts
 * @description Unit tests for configuration management system
 * Tests environment variable parsing, API key handling, validation, and error cases
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    parseApiKeys,
    loadConfiguration,
    validateConfiguration,
    getConfigSummary,
    createTestConfig
} from './config';
import type { ServerConfig } from './types';

describe('Configuration Management', () => {
    // Store original environment variables
    const originalEnv = process.env;

    beforeEach(() => {
        // Reset environment variables before each test
        process.env = { ...originalEnv };
        
        // Clear all provider API keys
        delete process.env.GEMINI_API_KEY;
        delete process.env.OPENROUTER_API_KEY;
        delete process.env.HUGGINGFACE_API_KEY;
        delete process.env.MISTRAL_API_KEY;
        delete process.env.COHERE_API_KEY;
        delete process.env.NVIDIA_API_KEY;
        delete process.env.CHUTES_API_KEY;
        delete process.env.REQUESTY_API_KEY;
        
        // Clear configuration environment variables
        delete process.env.PORT;
        delete process.env.DEFAULT_TEMPERATURE;
        delete process.env.DEFAULT_MAX_TOKENS;
        delete process.env.DEFAULT_TOP_P;
        delete process.env.SITE_URL;
        delete process.env.SITE_NAME;
        delete process.env.NODE_ENV;
        delete process.env.ENABLE_LOGGING;
        delete process.env.REQUEST_TIMEOUT;
    });

    afterEach(() => {
        // Restore original environment variables
        process.env = originalEnv;
    });

    describe('parseApiKeys', () => {
        it('should return empty object when no API keys are set', () => {
            const result = parseApiKeys();
            expect(result).toEqual({});
        });

        it('should parse single API key correctly', () => {
            process.env.OPENROUTER_API_KEY = 'single-key-123';
            
            const result = parseApiKeys();
            
            expect(result).toEqual({
                openrouter: 'single-key-123'
            });
        });

        it('should parse comma-separated API keys correctly', () => {
            process.env.OPENROUTER_API_KEY = 'key1,key2,key3';
            
            const result = parseApiKeys();
            
            expect(result).toEqual({
                openrouter: ['key1', 'key2', 'key3']
            });
        });

        it('should trim whitespace from comma-separated keys', () => {
            process.env.GEMINI_API_KEY = ' key1 , key2 , key3 ';
            
            const result = parseApiKeys();
            
            expect(result).toEqual({
                gemini: ['key1', 'key2', 'key3']
            });
        });

        it('should filter out empty keys from comma-separated list', () => {
            process.env.MISTRAL_API_KEY = 'key1,,key2,   ,key3';
            
            const result = parseApiKeys();
            
            expect(result).toEqual({
                mistral: ['key1', 'key2', 'key3']
            });
        });

        it('should parse multiple providers correctly', () => {
            process.env.OPENROUTER_API_KEY = 'or-key1,or-key2';
            process.env.GEMINI_API_KEY = 'gemini-single-key';
            process.env.HUGGINGFACE_API_KEY = 'hf-key1,hf-key2,hf-key3';
            
            const result = parseApiKeys();
            
            expect(result).toEqual({
                openrouter: ['or-key1', 'or-key2'],
                gemini: 'gemini-single-key',
                huggingface: ['hf-key1', 'hf-key2', 'hf-key3']
            });
        });

        it('should handle all supported providers', () => {
            process.env.GEMINI_API_KEY = 'gemini-key';
            process.env.OPENROUTER_API_KEY = 'openrouter-key';
            process.env.HUGGINGFACE_API_KEY = 'huggingface-key';
            process.env.MISTRAL_API_KEY = 'mistral-key';
            process.env.COHERE_API_KEY = 'cohere-key';
            process.env.NVIDIA_API_KEY = 'nvidia-key';
            process.env.CHUTES_API_KEY = 'chutes-key';
            process.env.REQUESTY_API_KEY = 'requesty-key';
            
            const result = parseApiKeys();
            
            expect(result).toEqual({
                gemini: 'gemini-key',
                openrouter: 'openrouter-key',
                huggingface: 'huggingface-key',
                mistral: 'mistral-key',
                cohere: 'cohere-key',
                nvidia: 'nvidia-key',
                chutes: 'chutes-key',
                requesty: 'requesty-key'
            });
        });
    });

    describe('loadConfiguration', () => {
        it('should load configuration with default values', () => {
            process.env.OPENROUTER_API_KEY = 'test-key';
            
            const config = loadConfiguration();
            
            expect(config).toEqual({
                port: 3000,
                apiKeys: { openrouter: 'test-key' },
                defaultSettings: {
                    temperature: 0.7,
                    maxTokens: 2048,
                    topP: 0.9,
                    siteUrl: 'http://localhost:3000',
                    siteName: 'LLM Rotation Server'
                },
                environment: 'development',
                enableLogging: true,
                requestTimeout: 30000
            });
        });

        it('should parse custom port correctly', () => {
            process.env.PORT = '8080';
            process.env.GEMINI_API_KEY = 'test-key';
            
            const config = loadConfiguration();
            
            expect(config.port).toBe(8080);
        });

        it('should parse custom default settings', () => {
            process.env.OPENROUTER_API_KEY = 'test-key';
            process.env.DEFAULT_TEMPERATURE = '0.5';
            process.env.DEFAULT_MAX_TOKENS = '1024';
            process.env.DEFAULT_TOP_P = '0.8';
            process.env.SITE_URL = 'https://example.com';
            process.env.SITE_NAME = 'Custom Server';
            
            const config = loadConfiguration();
            
            expect(config.defaultSettings).toEqual({
                temperature: 0.5,
                maxTokens: 1024,
                topP: 0.8,
                siteUrl: 'https://example.com',
                siteName: 'Custom Server'
            });
        });

        it('should parse environment and logging settings', () => {
            process.env.GEMINI_API_KEY = 'test-key';
            process.env.NODE_ENV = 'production';
            process.env.ENABLE_LOGGING = 'false';
            process.env.REQUEST_TIMEOUT = '60000';
            
            const config = loadConfiguration();
            
            expect(config.environment).toBe('production');
            expect(config.enableLogging).toBe(false);
            expect(config.requestTimeout).toBe(60000);
        });

        it('should enable logging in development by default', () => {
            process.env.OPENROUTER_API_KEY = 'test-key';
            process.env.NODE_ENV = 'development';
            
            const config = loadConfiguration();
            
            expect(config.enableLogging).toBe(true);
        });

        it('should throw error for invalid port', () => {
            process.env.PORT = 'invalid-port';
            process.env.GEMINI_API_KEY = 'test-key';
            
            expect(() => loadConfiguration()).toThrow('Invalid PORT value: invalid-port');
        });

        it('should throw error for port out of range', () => {
            process.env.PORT = '70000';
            process.env.GEMINI_API_KEY = 'test-key';
            
            expect(() => loadConfiguration()).toThrow('Invalid PORT value: 70000');
        });

        it('should throw error for invalid temperature', () => {
            process.env.OPENROUTER_API_KEY = 'test-key';
            process.env.DEFAULT_TEMPERATURE = '3.0';
            
            expect(() => loadConfiguration()).toThrow('Invalid DEFAULT_TEMPERATURE: 3.0');
        });

        it('should throw error for invalid max tokens', () => {
            process.env.OPENROUTER_API_KEY = 'test-key';
            process.env.DEFAULT_MAX_TOKENS = '-100';
            
            expect(() => loadConfiguration()).toThrow('Invalid DEFAULT_MAX_TOKENS: -100');
        });

        it('should throw error for invalid top_p', () => {
            process.env.OPENROUTER_API_KEY = 'test-key';
            process.env.DEFAULT_TOP_P = '1.5';
            
            expect(() => loadConfiguration()).toThrow('Invalid DEFAULT_TOP_P: 1.5');
        });

        it('should throw error for invalid request timeout', () => {
            process.env.OPENROUTER_API_KEY = 'test-key';
            process.env.REQUEST_TIMEOUT = '500';
            
            expect(() => loadConfiguration()).toThrow('Invalid REQUEST_TIMEOUT: 500');
        });
    });

    describe('validateConfiguration', () => {
        it('should pass validation with valid configuration', () => {
            const config: ServerConfig = {
                port: 3000,
                apiKeys: { openrouter: 'valid-key' },
                defaultSettings: {
                    temperature: 0.7,
                    maxTokens: 2048,
                    topP: 0.9,
                    siteUrl: 'http://localhost:3000',
                    siteName: 'Test Server'
                },
                environment: 'test',
                enableLogging: false,
                requestTimeout: 30000
            };
            
            expect(() => validateConfiguration(config)).not.toThrow();
        });

        it('should throw error when no API keys are configured', () => {
            const config: ServerConfig = {
                port: 3000,
                apiKeys: {},
                defaultSettings: {
                    temperature: 0.7,
                    maxTokens: 2048,
                    topP: 0.9,
                    siteUrl: 'http://localhost:3000',
                    siteName: 'Test Server'
                },
                environment: 'test',
                enableLogging: false,
                requestTimeout: 30000
            };
            
            expect(() => validateConfiguration(config)).toThrow('No API keys configured');
        });

        it('should throw error for empty string API key', () => {
            const config: ServerConfig = {
                port: 3000,
                apiKeys: { openrouter: '   ' },
                defaultSettings: {
                    temperature: 0.7,
                    maxTokens: 2048,
                    topP: 0.9,
                    siteUrl: 'http://localhost:3000',
                    siteName: 'Test Server'
                },
                environment: 'test',
                enableLogging: false,
                requestTimeout: 30000
            };
            
            expect(() => validateConfiguration(config)).toThrow('Empty API key configured for provider: openrouter');
        });

        it('should throw error for empty array API keys', () => {
            const config: ServerConfig = {
                port: 3000,
                apiKeys: { gemini: [] },
                defaultSettings: {
                    temperature: 0.7,
                    maxTokens: 2048,
                    topP: 0.9,
                    siteUrl: 'http://localhost:3000',
                    siteName: 'Test Server'
                },
                environment: 'test',
                enableLogging: false,
                requestTimeout: 30000
            };
            
            expect(() => validateConfiguration(config)).toThrow('Empty or invalid API keys configured for provider: gemini');
        });

        it('should throw error for array with empty keys', () => {
            const config: ServerConfig = {
                port: 3000,
                apiKeys: { mistral: ['valid-key', '   ', 'another-key'] },
                defaultSettings: {
                    temperature: 0.7,
                    maxTokens: 2048,
                    topP: 0.9,
                    siteUrl: 'http://localhost:3000',
                    siteName: 'Test Server'
                },
                environment: 'test',
                enableLogging: false,
                requestTimeout: 30000
            };
            
            expect(() => validateConfiguration(config)).toThrow('Empty or invalid API keys configured for provider: mistral');
        });
    });

    describe('getConfigSummary', () => {
        it('should return safe configuration summary', () => {
            const config: ServerConfig = {
                port: 3000,
                apiKeys: {
                    openrouter: ['key1', 'key2'],
                    gemini: 'single-key'
                },
                defaultSettings: {
                    temperature: 0.7,
                    maxTokens: 2048,
                    topP: 0.9,
                    siteUrl: 'https://example.com',
                    siteName: 'Test Server'
                },
                environment: 'production',
                enableLogging: true,
                requestTimeout: 45000
            };
            
            const summary = getConfigSummary(config);
            
            expect(summary).toEqual({
                port: 3000,
                environment: 'production',
                enableLogging: true,
                requestTimeout: 45000,
                providersConfigured: ['openrouter', 'gemini'],
                providerKeyCounts: {
                    openrouter: 2,
                    gemini: 1
                },
                defaultSettings: {
                    temperature: 0.7,
                    maxTokens: 2048,
                    topP: 0.9,
                    siteUrl: '[CONFIGURED]',
                    siteName: 'Test Server'
                }
            });
        });

        it('should handle missing site URL', () => {
            const config: ServerConfig = {
                port: 3000,
                apiKeys: { openrouter: 'key' },
                defaultSettings: {
                    temperature: 0.7,
                    maxTokens: 2048,
                    topP: 0.9,
                    siteName: 'Test Server'
                },
                environment: 'test',
                enableLogging: false,
                requestTimeout: 30000
            };
            
            const summary = getConfigSummary(config);
            
            expect(summary.defaultSettings.siteUrl).toBe('[NOT SET]');
        });
    });

    describe('createTestConfig', () => {
        it('should create default test configuration', () => {
            const config = createTestConfig();
            
            expect(config).toEqual({
                port: 3000,
                apiKeys: {
                    openrouter: 'test-key-1,test-key-2',
                    gemini: 'test-gemini-key'
                },
                defaultSettings: {
                    temperature: 0.7,
                    maxTokens: 2048,
                    topP: 0.9,
                    siteUrl: 'http://localhost:3000',
                    siteName: 'Test LLM Server'
                },
                environment: 'test',
                enableLogging: false,
                requestTimeout: 30000
            });
        });

        it('should apply overrides correctly', () => {
            const overrides = {
                port: 8080,
                environment: 'development',
                enableLogging: true
            };
            
            const config = createTestConfig(overrides);
            
            expect(config.port).toBe(8080);
            expect(config.environment).toBe('development');
            expect(config.enableLogging).toBe(true);
            // Other values should remain default
            expect(config.defaultSettings.temperature).toBe(0.7);
        });
    });
});