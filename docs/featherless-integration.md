# Featherless Provider Integration Guide

A tech-stack agnostic guide for integrating Featherless as an LLM provider.

## Overview

Featherless is an LLM provider running on a vLLM backend. It uses OpenAI-compatible endpoints with some parameter differences due to the vLLM infrastructure.

## API Details

| Property | Value |
|----------|-------|
| Base URL | `https://api.featherless.ai/v1` |
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
  "model": "GalrionSoftworks/Margnum-12B-v1",
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "Hello" }
  ],
  "temperature": 0.7,
  "max_tokens": 1000,
  "top_p": 1.0,
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
GET /v1/models
```

No authentication required.

**Response:**
```json
{
  "data": [
    {
      "id": "GalrionSoftworks/Margnum-12B-v1",
      "name": "Margnum 12B v1",
      "model_class": "...",
      "context_length": 8192
    }
  ]
}
```

## Supported Parameters

Featherless uses vLLM-native parameters instead of OpenAI-style penalties:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `model` | string | required | Model ID |
| `messages` | array | required | Conversation messages |
| `temperature` | float | 1.0 | Randomness (0-2) |
| `max_tokens` | int | varies | Max response length |
| `top_p` | float | 1.0 | Nucleus sampling |
| `repetition_penalty` | float | 1.0 | Penalize repeated tokens (vLLM-native) |
| `top_k` | int | -1 | Top-K sampling (-1 = disabled) |
| `min_p` | float | 0.0 | Minimum probability threshold |
| `stream` | bool | false | Enable SSE streaming |

**Important:** Do NOT use `frequency_penalty` or `presence_penalty` with Featherless. Use `repetition_penalty` instead to avoid conflicts with the vLLM backend.

## Rate Limits

Featherless has strict concurrency limits. Implement request queuing with a limit of **1 concurrent request** to avoid errors. Requests should be processed sequentially.

## Implementation Checklist

1. Store API key in environment/config (`FEATHERLESS_API_KEY`)
2. Set base URL to `https://api.featherless.ai/v1`
3. Use Bearer token authentication
4. Fetch models from `/v1/models` endpoint
5. Send completions to `/chat/completions`
6. Use vLLM-native parameters (`repetition_penalty`, `top_k`, `min_p`)
7. Implement request queuing (1 concurrent request max)

## Example (Pseudocode)

```
function chatCompletion(messages, model, options):
    request = HTTP.POST(
        url: "https://api.featherless.ai/v1/chat/completions",
        headers: {
            "Authorization": "Bearer " + API_KEY,
            "Content-Type": "application/json"
        },
        body: {
            model: model,
            messages: messages,
            temperature: options.temperature ?? 0.7,
            max_tokens: options.max_tokens ?? 1000,
            repetition_penalty: options.repetition_penalty ?? 1.0
        }
    )
    return request.json().choices[0].message.content
```

## Get an API Key

Sign up at https://featherless.ai/ to get your API key.
