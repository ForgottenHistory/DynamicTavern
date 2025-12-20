# NanoGPT Provider Integration Guide

A tech-stack agnostic guide for integrating NanoGPT as an LLM provider.

## Overview

NanoGPT is a pay-per-prompt LLM aggregator with 200+ models. It uses OpenAI-compatible endpoints, making integration straightforward if you already support OpenRouter or similar providers.

## API Details

| Property | Value |
|----------|-------|
| Base URL | `https://nano-gpt.com/api/v1` |
| Auth | Bearer token (`Authorization: Bearer {API_KEY}`) |
| Format | OpenAI-compatible |

## Endpoints

### Chat Completions
```
POST /chat/completions
```

**Request:**
```json
{
  "model": "chatgpt-4o-latest",
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "Hello" }
  ],
  "temperature": 0.7,
  "max_tokens": 1000,
  "top_p": 1.0,
  "frequency_penalty": 0.0,
  "presence_penalty": 0.0,
  "stream": false
}
```

**Response:**
```json
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "Hello! How can I help you today?"
      }
    }
  ]
}
```

### List Models
```
GET /models
```

No authentication required. Returns available models with pricing.

**Response:**
```json
{
  "data": [
    {
      "id": "chatgpt-4o-latest",
      "name": "ChatGPT-4o Latest",
      "context_length": 128000
    }
  ]
}
```

## Supported Parameters

NanoGPT supports all standard OpenAI parameters plus extended sampling:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `model` | string | required | Model ID |
| `messages` | array | required | Conversation messages |
| `temperature` | float | 1.0 | Randomness (0-2) |
| `max_tokens` | int | varies | Max response length |
| `top_p` | float | 1.0 | Nucleus sampling |
| `frequency_penalty` | float | 0.0 | Reduce repetition of tokens |
| `presence_penalty` | float | 0.0 | Encourage new topics |
| `repetition_penalty` | float | 1.0 | Alternative repetition control |
| `top_k` | int | -1 | Top-K sampling (-1 = disabled) |
| `min_p` | float | 0.0 | Minimum probability threshold |
| `stream` | bool | false | Enable SSE streaming |

## Streaming

For streaming responses, set `stream: true` and add the header:
```
Accept: text/event-stream
```

Response format is Server-Sent Events:
```
data: {"choices":[{"delta":{"content":"Hello"}}]}
data: {"choices":[{"delta":{"content":"!"}}]}
data: [DONE]
```

## Implementation Checklist

1. Store API key in environment/config (`NANOGPT_API_KEY`)
2. Set base URL to `https://nano-gpt.com/api/v1`
3. Use Bearer token authentication
4. Fetch models from `/models` endpoint for selection UI
5. Send completions to `/chat/completions`
6. Handle extended sampling parameters if your app uses them

## Rate Limits

NanoGPT has generous rate limits. A concurrency limit of ~50 parallel requests is a safe default, though higher may work depending on your account.

## Alternative Domains

These domains point to the same API:
- `https://ai.bitcoin.com`
- `https://bcashgpt.com`
- `https://cake.nano-gpt.com`

## Example (Pseudocode)

```
function chatCompletion(messages, model, options):
    request = HTTP.POST(
        url: "https://nano-gpt.com/api/v1/chat/completions",
        headers: {
            "Authorization": "Bearer " + API_KEY,
            "Content-Type": "application/json"
        },
        body: {
            model: model,
            messages: messages,
            temperature: options.temperature ?? 0.7,
            max_tokens: options.max_tokens ?? 1000
        }
    )
    return request.json().choices[0].message.content
```

## Get an API Key

Sign up at https://nano-gpt.com/ to get your API key.
