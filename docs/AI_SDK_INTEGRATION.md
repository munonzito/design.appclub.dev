# AI SDK Integration Guide

This document explains how App Club Design integrates with the [Vercel AI SDK](https://ai-sdk.dev/) for streaming AI responses and tool calling.

## Overview

We use AI SDK v5 with the following key features:
- **Experimental Agent class** for multi-step tool calling
- **UI Message Stream protocol** for real-time streaming
- **Custom streaming events** for early UI feedback

## Key Concepts

### Message Types

The AI SDK has two message formats:

| Type | Used For | Shape |
|------|----------|-------|
| `UIMessage` | Client ↔ Server | `{ id, role, parts: [{ type: 'text', text }] }` |
| `ModelMessage` | Server ↔ LLM | `{ role, content: string \| ContentPart[] }` |

**Conversion:** Use `convertToModelMessages(uiMessages)` before passing to `agent.stream()`.

```ts
// Server-side
const validated = await validateUIMessages({ messages })
const modelMessages = convertToModelMessages(validated)
const result = agent.stream({ messages: modelMessages })
```

### Agent vs streamText

| Method | Returns | Use Case |
|--------|---------|----------|
| `agent.respond()` | `Response` | Simple API routes, auto-converts UIMessage |
| `agent.stream()` | `StreamTextResult` | When you need custom stream handling |
| `streamText()` | `StreamTextResult` | Direct model access without Agent wrapper |

We use `agent.stream()` because we need to merge custom events into the stream.

## Streaming Protocol

The AI SDK streams responses using Server-Sent Events (SSE):

```
data: {"type":"text-delta","delta":"Hello"}

data: {"type":"tool-input-start","toolCallId":"abc","toolName":"upsertScreen"}

data: {"type":"tool-input-available","toolCallId":"abc","input":{...}}

data: {"type":"tool-output-available","toolCallId":"abc","output":{...}}

data: [DONE]
```

### Event Types

| Event | When | Contains |
|-------|------|----------|
| `text-delta` | LLM streaming text | `delta: string` |
| `tool-input-start` | Tool call begins | `toolCallId`, `toolName` |
| `tool-input-delta` | Tool args streaming | `toolCallId`, `inputTextDelta` |
| `tool-input-available` | Tool args complete | `toolCallId`, `toolName`, `input` |
| `tool-output-available` | Tool executed | `toolCallId`, `output` |
| `tool-output-error` | Tool failed | `toolCallId`, `errorText` |

**Docs:** https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol

## Custom Streaming with createUIMessageStream

To send custom events alongside the AI response, use `createUIMessageStream`:

```ts
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai'

const stream = createUIMessageStream({
  execute: ({ writer }) => {
    // Send custom event
    writer.write({
      type: 'data-my-custom-event',
      data: { foo: 'bar' },
      transient: true, // Don't persist in message history
    })

    // Merge AI response stream
    const result = agent.stream({ messages })
    writer.merge(result.toUIMessageStream())
  },
})

return createUIMessageStreamResponse({ stream })
```

**Docs:** https://ai-sdk.dev/docs/ai-sdk-ui/streaming-data

## Tool Lifecycle Hooks

Tools can have lifecycle hooks for streaming scenarios:

```ts
tool({
  description: '...',
  inputSchema: z.object({ ... }),
  
  // Called when tool call starts (no args yet)
  onInputStart: ({ toolCallId }) => { ... },
  
  // Called for each chunk of streaming args
  onInputDelta: ({ toolCallId, inputTextDelta }) => { ... },
  
  // Called when args are complete and validated
  onInputAvailable: ({ toolCallId, input }) => { ... },
  
  execute: async (args) => { ... },
})
```

**Important:** `onInputStart` and `onInputDelta` are only called with `streamText`, not `generateText`.

**Docs:** https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling#tool-input-lifecycle-hooks

## Our Implementation

### Early Editing Overlay

**Problem:** Tool execution is fast, so `tool-input-available` and `tool-output-available` arrive almost simultaneously. The editing overlay appears too late.

**Solution:** Use `onInputDelta` to parse the screen ID from partial JSON as it streams:

```ts
// server/api/chat.post.ts
onUpsertInputDelta: (toolCallId, delta) => {
  buffer += delta
  const idMatch = buffer.match(/"id"\s*:\s*"([^"]+)"/)
  if (idMatch) {
    writer.write({
      type: 'data-editing-start',
      data: { screenId: idMatch[1], toolCallId },
      transient: true,
    })
  }
}
```

The client handles `data-editing-start` to show the overlay immediately.

### Client-Side SSE Parsing

We manually parse the SSE stream in `composables/chat/parseSSEStream.ts`:

```ts
// Parse SSE format: "data: <json>\n\n"
const separatorIndex = buffer.indexOf('\n\n')
const rawEvent = buffer.slice(0, separatorIndex)
const data = rawEvent.slice('data:'.length).trim()
const chunk = JSON.parse(data)
```

This is necessary because we're not using `useChat` from `@ai-sdk/vue` (we need more control).

## File Structure

```
server/
├── api/
│   └── chat.post.ts      # API route with custom streaming
└── utils/
    ├── ai-tools.ts       # Tool definitions with onInputDelta
    └── designAgent.ts    # Agent configuration

composables/
├── useChatAgent.ts       # Chat state and submission
└── chat/
    ├── parseSSEStream.ts # SSE parsing utility
    ├── handleToolEvents.ts # Event → side effect mapping
    └── types.ts          # Message types
```

## Useful Links

- [AI SDK Documentation](https://ai-sdk.dev/docs)
- [Building Agents](https://ai-sdk.dev/docs/agents/building-agents)
- [Tool Calling](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)
- [Streaming Custom Data](https://ai-sdk.dev/docs/ai-sdk-ui/streaming-data)
- [Stream Protocol](https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol)
- [UI Message Stream Reference](https://ai-sdk.dev/docs/reference/ai-sdk-ui/create-ui-message-stream)
