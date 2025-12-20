/**
 * Chat Agent Composable
 * 
 * Manages chat state and communication with the AI design agent.
 * Uses the AI SDK UI Message Stream protocol for real-time updates.
 * 
 * @see docs/AI_SDK_INTEGRATION.md for streaming protocol details
 */

import { reactive, ref } from 'vue'
import { useProjectState } from './useProjectState'
import { parseSSEStream } from './chat/parseSSEStream'
import { createToolEventHandler } from './chat/handleToolEvents'
import type { Message, UIMessagePayload } from './chat/types'

export type { Message } from './chat/types'

export const useChatAgent = () => {
  const {
    upsertScreen,
    restoreVersion,
    screens,
    setEditingScreenId,
    setIsDesigning,
  } = useProjectState()

  const messages = ref<Message[]>([])
  const input = ref('')
  const isLoading = ref(false)

  const handleSubmit = async () => {
    if (!input.value.trim() || isLoading.value) return

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.value,
    }
    messages.value.push(userMessage)
    
    const currentInput = input.value
    input.value = ''
    isLoading.value = true

    try {
      // Convert messages to AI SDK UIMessage format
      const uiMessages: UIMessagePayload[] = messages.value
        .filter((m): m is Message & { role: 'user' | 'assistant' } => m.role !== 'tool')
        .map(m => ({
          id: m.id,
          role: m.role,
          parts: [{ type: 'text', text: m.content }],
        }))

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          screens: screens.value,
          messages: uiMessages,
        }),
      })

      if (!response.ok) {
        throw new Error(`Chat request failed: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body reader')
      }

      // Create reactive assistant message for streaming updates
      const assistantMessage = reactive<Message>({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        toolInvocations: [],
      })
      messages.value.push(assistantMessage)

      // Track tool call -> screen ID mappings
      const toolCallIdToScreenId = new Map<string, string>()

      // Create event handler with dependencies
      const handleChunk = createToolEventHandler({
        assistantMessage,
        toolCallIdToScreenId,
        upsertScreen,
        restoreVersion,
        setEditingScreenId,
        setIsDesigning,
      })

      // Parse and handle SSE stream
      await parseSSEStream(reader, {
        onChunk: handleChunk,
        onError: (error) => console.error('[chat] SSE parse error:', error),
      })

      // Clean up trailing whitespace
      assistantMessage.content = assistantMessage.content.trimEnd()

    } catch (error) {
      console.error('[chat] Error:', error)
    } finally {
      isLoading.value = false
      setEditingScreenId(null)
      setIsDesigning(false)
    }
  }

  return {
    messages,
    input,
    handleSubmit,
    isLoading,
  }
}
