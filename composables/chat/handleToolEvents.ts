/**
 * Tool Event Handler for AI SDK streaming responses.
 * 
 * Maps SSE chunk types to side effects (state updates, UI changes).
 * This centralizes all tool-related logic that was previously in useChatAgent.
 */

import { nextTick } from 'vue'
import { debug } from '~/lib/debug'
import type { SSEChunk } from './parseSSEStream'
import type { Message, ToolInvocation } from './types'

export interface ToolEventHandlerDeps {
  /** Reactive assistant message being built */
  assistantMessage: Message
  /** Map of toolCallId -> screenId for tracking which screen a tool is editing */
  toolCallIdToScreenId: Map<string, string>
  /** Project state actions */
  upsertScreen: (screen: { id: string; name?: string; html?: string; css?: string }, options?: { skipHistory?: boolean }) => void
  restoreVersion: (index: number) => void
  setEditingScreenId: (id: string | null) => void
  setIsDesigning: (value: boolean) => void
}

/**
 * Creates a handler function for SSE chunks.
 * Returns a function that processes each chunk and triggers appropriate side effects.
 */
export function createToolEventHandler(deps: ToolEventHandlerDeps) {
  const {
    assistantMessage,
    toolCallIdToScreenId,
    upsertScreen,
    restoreVersion,
    setEditingScreenId,
    setIsDesigning,
  } = deps

  /** Get or create a tool invocation entry */
  const getOrCreateInvocation = (toolCallId: string, toolName?: string): ToolInvocation => {
    const existing = assistantMessage.toolInvocations?.find(i => i.toolCallId === toolCallId)
    if (existing) {
      if (toolName && !existing.toolName) existing.toolName = toolName
      return existing
    }

    const created: ToolInvocation = {
      toolCallId,
      toolName,
      state: 'call',
    }
    assistantMessage.toolInvocations?.push(created)
    return created
  }

  /** Handle a single SSE chunk */
  return async function handleChunk(chunk: SSEChunk): Promise<void> {
    switch (chunk.type) {
      case 'text-delta':
        assistantMessage.content += chunk.delta as string
        break

      case 'tool-input-start':
        debug.tools('input-start', chunk.toolName, chunk.toolCallId)
        getOrCreateInvocation(chunk.toolCallId as string, chunk.toolName as string)
        if (chunk.toolName === 'upsertScreen') {
          setIsDesigning(true)
        }
        break

      case 'data-editing-start': {
        // Custom event: server extracted screen ID from partial tool input
        const data = chunk.data as { screenId?: string; toolCallId?: string } | undefined
        const screenId = data?.screenId
        const toolCallId = data?.toolCallId
        debug.tools('editing-start (early)', screenId, toolCallId)

        if (typeof screenId === 'string' && typeof toolCallId === 'string') {
          toolCallIdToScreenId.set(toolCallId, screenId)
          setEditingScreenId(screenId)

          // Create placeholder screen node immediately
          upsertScreen(
            { id: screenId, name: 'Designing...' },
            { skipHistory: true },
          )

          // Let Vue render the new node before processing more events
          await nextTick()
        }
        break
      }

      case 'tool-input-available': {
        const invocation = getOrCreateInvocation(chunk.toolCallId as string, chunk.toolName as string)
        const input = chunk.input as Record<string, unknown> | undefined
        invocation.args = input
        invocation.state = 'call'
        debug.tools('input-available', invocation.toolName, chunk.toolCallId)

        if (invocation.toolName === 'upsertScreen' && typeof input?.id === 'string') {
          toolCallIdToScreenId.set(chunk.toolCallId as string, input.id)
          setEditingScreenId(input.id)

          // Ensure screen node exists (may already exist from data-editing-start)
          upsertScreen(
            {
              id: input.id,
              name: typeof input?.name === 'string' ? input.name : 'Untitled Screen',
            },
            { skipHistory: true },
          )

          await nextTick()
        }
        break
      }

      case 'tool-output-available': {
        const invocation = getOrCreateInvocation(chunk.toolCallId as string)
        const output = chunk.output as Record<string, unknown> | undefined
        invocation.state = 'result'
        invocation.result = output
        debug.tools('output-available', invocation.toolName, chunk.toolCallId)

        // Trigger frontend side effects based on tool type
        if (invocation.toolName === 'upsertScreen' && output) {
          upsertScreen(output as { id: string; name?: string; html?: string; css?: string })
          toolCallIdToScreenId.delete(chunk.toolCallId as string)
          setEditingScreenId(null)
          setIsDesigning(false)
        } else if (invocation.toolName === 'restoreVersion' && output) {
          restoreVersion((output as { index: number }).index)
        }
        break
      }

      case 'tool-output-error': {
        const invocation = getOrCreateInvocation(chunk.toolCallId as string)
        invocation.state = 'error'
        invocation.errorText = chunk.errorText as string
        debug.tools('output-error', invocation.toolName, chunk.toolCallId, chunk.errorText)

        if (invocation.toolName === 'upsertScreen') {
          toolCallIdToScreenId.delete(chunk.toolCallId as string)
          setEditingScreenId(null)
          setIsDesigning(false)
        }
        break
      }

      case 'error':
        console.error('AI stream error:', chunk.errorText)
        break

      // Ignore other event types (e.g., tool-input-delta, step-start, etc.)
    }
  }
}
