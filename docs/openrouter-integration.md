# OpenRouter Provider Integration Guide

A tech-stack agnostic guide for integrating OpenRouter as an LLM provider.

## Overview

OpenRouter is an LLM aggregator providing access to 300+ models from various providers (OpenAI, Anthropic, Google, Meta, etc.) through a single API. It uses OpenAI-compatible endpoints.

## API Details

| Property | Value |
|----------|-------|
| Base URL | `https://openrouter.ai/api/v1` |
| Auth | Bearer token (`Authorization: Bearer {API_KEY}`) |
| Format | OpenAI-compatible |

## Endpoints

### Chat Completions
```
POST /chat/completions
```

**Headers:**
```
Authorization: Bearer {API_KEY}
Content-Type: application/json
HTTP-Referer: https://your-app.com  (optional, for rankings)
X-Title: Your App Name              (optional, for rankings)
```

**Request:**
```json
{
  "model": "deepseek/deepseek-chat-v3",
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
  ],
  "usage": {
    "prompt_tokens": 25,
    "completion_tokens": 10,
    "total_tokens": 35
  }
}
```

### List Models
```
GET /api/v1/models
```

No authentication required.

**Response:**
```json
{
  "data": [
    {
      "id": "deepseek/deepseek-chat-v3",
      "name": "DeepSeek Chat v3",
      "pricing": {
        "prompt": "0.0000001",
        "completion": "0.0000002"
      },
      "context_length": 128000
    }
  ]
}
```

## Supported Parameters

OpenRouter uses OpenAI-style parameters:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `model` | string | required | Model ID |
| `messages` | array | required | Conversation messages |
| `temperature` | float | 1.0 | Randomness (0-2) |
| `max_tokens` | int | varies | Max response length |
| `top_p` | float | 1.0 | Nucleus sampling |
| `frequency_penalty` | float | 0.0 | Reduce token repetition |
| `presence_penalty` | float | 0.0 | Encourage new topics |
| `stream` | bool | false | Enable SSE streaming |

Extended parameters (supported by many models):

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `repetition_penalty` | float | 1.0 | Alternative repetition control |
| `top_k` | int | -1 | Top-K sampling (-1 = disabled) |
| `min_p` | float | 0.0 | Minimum probability threshold |

## Model Variants

OpenRouter provides model variants via suffixes:

| Suffix | Description |
|--------|-------------|
| `:free` | Free tier (rate limited) |
| `:extended` | Extended context window |
| `:thinking` | Reasoning/chain-of-thought mode |
| `:online` | Web search enabled |
| `:nitro` | Faster inference |

Example: `google/gemini-2.0-flash-exp:free`

## Identifying Free Models

Free models can be identified by:
- `pricing.prompt === "0"` in the models response
- Model ID containing `:free` suffix

## Rate Limits

OpenRouter has generous rate limits. A concurrency limit of ~100 parallel requests is typical for most accounts.

## Reasoning Mode

For models that support reasoning (like DeepSeek), add:

```json
{
  "reasoning": {
    "effort": "medium"
  }
}
```

## Implementation Checklist

1. Store API key in environment/config (`OPENROUTER_API_KEY`)
2. Set base URL to `https://openrouter.ai/api/v1`
3. Use Bearer token authentication
4. Add `HTTP-Referer` and `X-Title` headers (optional but recommended)
5. Fetch models from `/api/v1/models` endpoint
6. Send completions to `/chat/completions`
7. Use OpenAI-style parameters (`frequency_penalty`, `presence_penalty`)

## Example (Pseudocode)

```
function chatCompletion(messages, model, options):
    request = HTTP.POST(
        url: "https://openrouter.ai/api/v1/chat/completions",
        headers: {
            "Authorization": "Bearer " + API_KEY,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://your-app.com",
            "X-Title": "Your App Name"
        },
        body: {
            model: model,
            messages: messages,
            temperature: options.temperature ?? 0.7,
            max_tokens: options.max_tokens ?? 1000,
            frequency_penalty: options.frequency_penalty ?? 0.0,
            presence_penalty: options.presence_penalty ?? 0.0
        }
    )
    return request.json().choices[0].message.content
```

## Get an API Key

Sign up at https://openrouter.ai/ to get your API key.
