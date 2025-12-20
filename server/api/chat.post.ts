/**
 * Chat API Route
 * 
 * Handles chat messages and streams AI responses using the design agent.
 * Uses the AI SDK UI Message Stream protocol for real-time updates.
 * 
 * @see https://ai-sdk.dev/docs/ai-sdk-ui/streaming-data
 */

import { validateUIMessages, createUIMessageStream, createUIMessageStreamResponse, convertToModelMessages } from 'ai'
import { createTools } from '../utils/ai-tools'
import { createDesignAgent } from '../utils/designAgent'

const isDebug = process.env.NODE_ENV !== 'production'

/** Extract text content from a UIMessage for logging */
const extractText = (message: any): string => {
  const parts = Array.isArray(message?.parts) ? message.parts : []
  return parts
    .filter((p: any) => p?.type === 'text' && typeof p?.text === 'string')
    .map((p: any) => p.text)
    .join('')
}

export default defineEventHandler(async (event) => {
  const { messages, screens } = await readBody(event)

  if (isDebug) {
    const last = Array.isArray(messages) ? messages[messages.length - 1] : undefined
    const text = extractText(last)
    console.log('[api/chat] request', {
      messageCount: Array.isArray(messages) ? messages.length : null,
      lastRole: last?.role,
      lastTextPreview: text ? `${text.slice(0, 300)}${text.length > 300 ? '…' : ''}` : '',
    })
  }

  const validated = await validateUIMessages({ messages })

  if (isDebug) {
    console.log('[api/chat] validated', {
      messageCount: validated.length,
    })
  }

  // Track partial input for upsertScreen to extract ID early
  const upsertInputBuffers = new Map<string, string>()
  const sentEditingStart = new Set<string>()

  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      // Create tools with early ID extraction for editing overlay
      const tools = createTools({
        screens,
        onUpsertInputDelta: (toolCallId: string, delta: string) => {
          // Accumulate partial tool input to extract screen ID early
          const current = upsertInputBuffers.get(toolCallId) || ''
          const updated = current + delta
          upsertInputBuffers.set(toolCallId, updated)

          // Try to extract ID from partial JSON before tool execution completes
          if (!sentEditingStart.has(toolCallId)) {
            const idMatch = updated.match(/"id"\s*:\s*"([^"]+)"/)
            if (idMatch) {
              const screenId = idMatch[1]
              sentEditingStart.add(toolCallId)

              if (isDebug) {
                console.log('[api/chat] extracted screen ID from partial input:', screenId)
              }

              // Send custom event to client for immediate UI feedback
              writer.write({
                type: 'data-editing-start',
                data: { screenId, toolCallId },
                transient: true,
              })
            }
          }
        },
      })

      const agent = createDesignAgent(tools)
      const modelMessages = convertToModelMessages(validated)
      const result = agent.stream({ messages: modelMessages })
      writer.merge(result.toUIMessageStream())
    },
  })

  return createUIMessageStreamResponse({ stream })
})
