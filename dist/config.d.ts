/**
 * @file config.ts
 * @description Configuration management system for the LLM Rotation Server
 * Provides type-safe environment variable parsing, API key management,
 * and default configuration handling with support for comma-separated keys
 */
import type { ApiKeys } from './llm_rotation';
import type { ServerConfig } from './types';
/**
 * Parse API keys from environment variables with support for comma-separated keys
 * Supports both single keys and arrays: OPENROUTER_API_KEY=key1,key2,key3
 *
 * @returns ApiKeys object with parsed keys for each provider
 */
export declare function parseApiKeys(): ApiKeys;
/**
 * Load complete server configuration from environment variables
 * Provides type-safe parsing with sensible defaults
 *
 * @returns ServerConfig object with all configuration settings
 */
export declare function loadConfiguration(): ServerConfig;
/**
 * Validate that at least one API key is configured
 *
 * @param config - Server configuration to validate
 * @throws Error if no API keys are configured
 */
export declare function validateConfiguration(config: ServerConfig): void;
/**
 * Get configuration summary for logging (without exposing sensitive data)
 *
 * @param config - Server configuration
 * @returns Safe configuration summary for logging
 */
export declare function getConfigSummary(config: ServerConfig): Record<string, any>;
/**
 * Create a minimal configuration for testing purposes
 *
 * @param overrides - Optional configuration overrides
 * @returns Test configuration
 */
export declare function createTestConfig(overrides?: Partial<ServerConfig>): ServerConfig;
//# sourceMappingURL=config.d.ts.map