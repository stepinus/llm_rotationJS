# 🚀 LLM Rotation JS

<div align="center">
  <img src="https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white" />
  <img src="https://img.shields.io/badge/ES6+-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" />
  <img src="https://img.shields.io/badge/MIT-License-blue?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Version-1.0.0-green?style=for-the-badge" />
</div>

<div align="center">
  <h3>🔄 Intelligent LLM Provider Management with Automatic API Key Rotation</h3>
  <p><em>A robust, production-ready module for seamless multi-provider LLM integration with smart fallback mechanisms</em></p>
</div>

---

## ✨ Features

<table>
<tr>
<td width="33%">

### 🔑 **Smart Key Rotation**
- Automatic API key cycling
- Intelligent fallback system
- Rate limit detection & handling
- Status tracking per key

</td>
<td width="33%">

### 🌐 **Multi-Provider Support**
- **8 Major Providers** supported
- Unified interface for all APIs
- Provider-specific optimizations
- Easy provider switching

</td>
<td width="33%">

### ⚡ **Production Ready**
- Error handling & recovery
- Async/await architecture
- Comprehensive logging
- TypeScript-friendly

</td>
</tr>
</table>

---

## 🎯 Supported Providers

<div align="center">

| Provider | Models | Free Tier | Special Features |
|----------|---------|-----------|------------------|
| 🔷 **OpenRouter** | 6+ models | ✅ | Free tier available |
| 🤗 **Hugging Face** | 4+ models | ✅ | Multi-backend support |
| 💎 **Google Gemini** | 5+ models | ✅ | Thinking budget support |
| 🌟 **Mistral AI** | 4+ models | ✅ | High-performance models |
| 🚀 **Cohere** | 3+ models | ✅ | Command series |
| 🔋 **NVIDIA** | 3+ models | ✅ | Nemotron optimizations |
| 🎭 **Chutes AI** | 4+ models | ✅ | Specialized endpoints |
| 🔗 **Requesty** | Custom | ❌ | Router service |

</div>

---

## 🚀 Quick Start

### Installation

```bash
npm install @google/genai @huggingface/inference @mistralai/mistralai cohere-ai openai node-fetch
```

### Basic Usage

```javascript
import LlmManager from './llm_rotation.js';

const llmManager = new LlmManager();

const settings = {
    provider: 'openrouter',
    model: 'moonshotai/kimi-k2:free',
    apiKeys: {
        openrouter: ['key1', 'key2', 'key3'] // Multiple keys for rotation
    },
    temperature: 0.7,
    maxTokens: 2048
};

const prompt = [
    { role: 'user', content: 'Hello, how are you?' }
];

try {
    const response = await llmManager.generateResponse(prompt, settings);
    console.log(response);
} catch (error) {
    console.error('Error:', error.message);
}
```

---

## 🔧 Advanced Configuration

### Provider-Specific Settings

<details>
<summary><strong>🔷 OpenRouter Configuration</strong></summary>

```javascript
const settings = {
    provider: 'openrouter',
    model: 'moonshotai/kimi-k2:free',
    apiKeys: { openrouter: ['key1', 'key2'] },
    siteUrl: 'https://yoursite.com',  // Required
    siteName: 'Your App Name',        // Required
    temperature: 0.7
};
```

</details>

<details>
<summary><strong>💎 Google Gemini with Thinking Budget</strong></summary>

```javascript
const settings = {
    provider: 'gemini',
    model: 'gemini-2.5-pro',  // Supports thinking budget
    apiKeys: { gemini: ['key1', 'key2'] },
    temperature: 0.8,
    maxTokens: 4096
};
```

</details>

<details>
<summary><strong>🤗 Hugging Face with Provider Override</strong></summary>

```javascript
const settings = {
    provider: 'huggingface',
    model: 'deepseek-ai/DeepSeek-V3-0324',
    apiKeys: { huggingface: ['key1'] },
    providerOverride: 'sambanova',  // Override backend
    temperature: 0.6
};
```

</details>

<details>
<summary><strong>🔋 NVIDIA with Model Optimizations</strong></summary>

```javascript
const settings = {
    provider: 'nvidia',
    model: 'nvidia/llama-3.1-nemotron-ultra-253b-v1',
    apiKeys: { nvidia: ['nvapi-key'] },
    temperature: 0.75
};
```

</details>

---

## 📊 API Key Status Monitoring

```javascript
// Check the status of all API keys
console.log('API Key Status:', llmManager.apiKeyStatus);

// Example output:
// {
//   openrouter: ['working', 'rate-limited', 'failed'],
//   gemini: ['working', 'untested'],
//   huggingface: ['working']
// }
```

**Status Types:**
- `'untested'` - Key hasn't been used yet
- `'working'` - Key is functioning normally
- `'rate-limited'` - Key hit rate limits
- `'failed'` - Key failed authentication or other error

---

## 🎨 Model Configurations

Access detailed model information for UI building:

```javascript
import LlmManager from './llm_rotation.js';

// Get all available models
const models = LlmManager.modelConfigurations;

// Example: Build a dropdown
models.openrouter.forEach(model => {
    console.log(`${model.name} (${model.id}) - Free: ${model.free || false}`);
});
```

---

## 🛠️ Error Handling & Recovery

The module includes comprehensive error handling:

```javascript
try {
    const response = await llmManager.generateResponse(prompt, settings);
    return response;
} catch (error) {
    if (error.message.includes('rate')) {
        // Handle rate limiting
        console.log('Rate limited, trying again later...');
    } else if (error.message.includes('All') && error.message.includes('failed')) {
        // All keys failed
        console.log('All API keys exhausted');
    }
    
    // Check final status
    console.log('Final key statuses:', llmManager.apiKeyStatus);
}
```

---

## 📈 Performance Features

<div align="center">

### 🔄 **Automatic Rotation**
Keys are automatically rotated after successful requests to distribute load evenly

### 🚨 **Smart Fallback**
Failed keys are skipped, rate-limited keys are marked for later retry

### 📊 **Status Tracking**
Real-time monitoring of API key health and performance

### ⚡ **Optimized Requests**
Provider-specific optimizations for maximum compatibility

</div>

---

## 🔍 Debugging & Development

Enable detailed logging for development:

```javascript
// The module logs errors automatically
// Check console for detailed error messages and API key rotation info
```

---

## 🤝 Contributing

We welcome contributions! Here's how you can help:

1. 🍴 Fork the repository
2. 🌟 Create a feature branch: `git checkout -b feature/amazing-feature`
3. 💬 Commit your changes: `git commit -m 'Add amazing feature'`
4. 📤 Push to the branch: `git push origin feature/amazing-feature`
5. 🔄 Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Thanks to all LLM providers for their excellent APIs
- Built with ❤️ for the AI development community
- Special thanks to contributors and testers

---

<div align="center">
  <h3>🌟 Star this repo if you found it helpful!</h3>
  <p>Made with ❤️ by <a href="https://github.com/chungus1310">@chungus1310</a></p>
</div>

---

<div align="center">
  <img src="https://img.shields.io/github/stars/chungus1310/llm_rotationJS?style=social" />
  <img src="https://img.shields.io/github/forks/chungus1310/llm_rotationJS?style=social" />
  <img src="https://img.shields.io/github/watchers/chungus1310/llm_rotationJS?style=social" />
</div>
