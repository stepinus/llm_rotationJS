"use strict";
/**
 * @file config.ts
 * @description Configuration management system for the LLM Rotation Server
 * Provides type-safe environment variable parsing, API key management,
 * and default configuration handling with support for comma-separated keys
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseApiKeys = parseApiKeys;
exports.loadConfiguration = loadConfiguration;
exports.validateConfiguration = validateConfiguration;
exports.getConfigSummary = getConfigSummary;
exports.createTestConfig = createTestConfig;
/**
 * List of supported providers for API key parsing
 */
const SUPPORTED_PROVIDERS = [
    'gemini',
    'openrouter',
    'huggingface',
    'mistral',
    'cohere',
    'nvidia',
    'chutes',
    'requesty'
];
/**
 * Parse API keys from environment variables with support for comma-separated keys
 * Supports both single keys and arrays: OPENROUTER_API_KEY=key1,key2,key3
 *
 * @returns ApiKeys object with parsed keys for each provider
 */
function parseApiKeys() {
    const keys = {};
    SUPPORTED_PROVIDERS.forEach(provider => {
        const envKey = `${provider.toUpperCase()}_API_KEY`;
        const envValue = process.env[envKey];
        if (envValue) {
            // Check if the value contains commas (multiple keys)
            if (envValue.includes(',')) {
                // Split by comma and trim whitespace from each key
                keys[provider] = envValue.split(',').map(k => k.trim()).filter(k => k.length > 0);
            }
            else {
                // Single key
                keys[provider] = envValue.trim();
            }
        }
    });
    return keys;
}
/**
 * Load complete server configuration from environment variables
 * Provides type-safe parsing with sensible defaults
 *
 * @returns ServerConfig object with all configuration settings
 */
function loadConfiguration() {
    // Parse port with validation
    const portStr = process.env.PORT || '3000';
    const port = parseInt(portStr, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
        throw new Error(`Invalid PORT value: ${portStr}. Must be a number between 1 and 65535.`);
    }
    // Parse API keys
    const apiKeys = parseApiKeys();
    // Create default LLM settings
    const defaultSettings = {
        temperature: parseFloat(process.env.DEFAULT_TEMPERATURE || '0.7'),
        maxTokens: parseInt(process.env.DEFAULT_MAX_TOKENS || '2048', 10),
        topP: parseFloat(process.env.DEFAULT_TOP_P || '0.9'),
        siteUrl: process.env.SITE_URL || 'http://localhost:3000',
        siteName: process.env.SITE_NAME || 'LLM Rotation Server'
    };
    // Validate default settings
    if (isNaN(defaultSettings.temperature) || defaultSettings.temperature < 0 || defaultSettings.temperature > 2) {
        throw new Error(`Invalid DEFAULT_TEMPERATURE: ${process.env.DEFAULT_TEMPERATURE}. Must be between 0 and 2.`);
    }
    if (isNaN(defaultSettings.maxTokens) || defaultSettings.maxTokens < 1) {
        throw new Error(`Invalid DEFAULT_MAX_TOKENS: ${process.env.DEFAULT_MAX_TOKENS}. Must be a positive integer.`);
    }
    if (isNaN(defaultSettings.topP) || defaultSettings.topP < 0 || defaultSettings.topP > 1) {
        throw new Error(`Invalid DEFAULT_TOP_P: ${process.env.DEFAULT_TOP_P}. Must be between 0 and 1.`);
    }
    // Parse optional settings
    const environment = process.env.NODE_ENV || 'development';
    const enableLogging = process.env.ENABLE_LOGGING?.toLowerCase() === 'true' || environment === 'development';
    const requestTimeoutStr = process.env.REQUEST_TIMEOUT || '30000';
    const requestTimeout = parseInt(requestTimeoutStr, 10);
    if (isNaN(requestTimeout) || requestTimeout < 1000) {
        throw new Error(`Invalid REQUEST_TIMEOUT: ${requestTimeoutStr}. Must be at least 1000ms.`);
    }
    return {
        port,
        apiKeys,
        defaultSettings,
        environment,
        enableLogging,
        requestTimeout
    };
}
/**
 * Validate that at least one API key is configured
 *
 * @param config - Server configuration to validate
 * @throws Error if no API keys are configured
 */
function validateConfiguration(config) {
    const hasAnyKeys = Object.keys(config.apiKeys).length > 0;
    if (!hasAnyKeys) {
        throw new Error('No API keys configured. Please set at least one provider API key using environment variables. ' +
            'Example: OPENROUTER_API_KEY=your-key-here or GEMINI_API_KEY=key1,key2,key3');
    }
    // Validate that all configured keys are non-empty
    for (const [provider, keys] of Object.entries(config.apiKeys)) {
        if (typeof keys === 'string') {
            if (keys.trim().length === 0) {
                throw new Error(`Empty API key configured for provider: ${provider}`);
            }
        }
        else if (Array.isArray(keys)) {
            if (keys.length === 0 || keys.some(key => key.trim().length === 0)) {
                throw new Error(`Empty or invalid API keys configured for provider: ${provider}`);
            }
        }
    }
}
/**
 * Get configuration summary for logging (without exposing sensitive data)
 *
 * @param config - Server configuration
 * @returns Safe configuration summary for logging
 */
function getConfigSummary(config) {
    const providerKeyCounts = {};
    for (const [provider, keys] of Object.entries(config.apiKeys)) {
        if (typeof keys === 'string') {
            providerKeyCounts[provider] = 1;
        }
        else if (Array.isArray(keys)) {
            providerKeyCounts[provider] = keys.length;
        }
    }
    return {
        port: config.port,
        environment: config.environment,
        enableLogging: config.enableLogging,
        requestTimeout: config.requestTimeout,
        providersConfigured: Object.keys(config.apiKeys),
        providerKeyCounts,
        defaultSettings: {
            temperature: config.defaultSettings.temperature,
            maxTokens: config.defaultSettings.maxTokens,
            topP: config.defaultSettings.topP,
            siteUrl: config.defaultSettings.siteUrl ? '[CONFIGURED]' : '[NOT SET]',
            siteName: config.defaultSettings.siteName
        }
    };
}
/**
 * Create a minimal configuration for testing purposes
 *
 * @param overrides - Optional configuration overrides
 * @returns Test configuration
 */
function createTestConfig(overrides = {}) {
    const defaultConfig = {
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
    };
    return { ...defaultConfig, ...overrides };
}
//# sourceMappingURL=config.js.map