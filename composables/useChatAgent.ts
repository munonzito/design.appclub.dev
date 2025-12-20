import { nextTick, reactive, ref } from 'vue'
import { useProjectState } from './useProjectState'

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'tool'
  content: string
  toolInvocations?: any[]
}

type UIMessage = {
  id: string
  role: 'user' | 'assistant'
  parts: Array<{ type: 'text'; text: string }>
}

export const useChatAgent = () => {
  const { upsertScreen, restoreVersion, screens, setEditingScreenId, setIsDesigning } = useProjectState()
  const messages = ref<Message[]>([])
  const input = ref('')
  const isLoading = ref(false)

  const handleSubmit = async () => {
    if (!input.value || isLoading.value) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.value
    }

    messages.value.push(userMessage)
    const currentInput = input.value
    input.value = ''
    isLoading.value = true

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          screens: screens.value,
          messages: messages.value
            .filter((m): m is Message & { role: 'user' | 'assistant' } => m.role !== 'tool')
            .map<UIMessage>(m => ({
              id: m.id,
              role: m.role,
              parts: [{ type: 'text', text: m.content }]
            }))
        })
      })

      if (!response.ok) throw new Error('Failed to send message')

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No reader')

      // Must be reactive because we mutate nested fields (toolInvocations/results)
      // while streaming; mutating a non-reactive object won't update the UI.
      const assistantMessage = reactive<Message>({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        toolInvocations: []
      })
      messages.value.push(assistantMessage)

      const decoder = new TextDecoder()
      let done = false
      let buffer = ''
      let streamDone = false

      const toolCallIdToScreenId = new Map<string, string>()

      const getOrCreateInvocation = (toolCallId: string, toolName?: string) => {
        const existing = assistantMessage.toolInvocations?.find(i => i.toolCallId === toolCallId)
        if (existing) {
          if (toolName && !existing.toolName) existing.toolName = toolName
          return existing
        }

        const created = {
          toolCallId,
          toolName,
          state: 'call'
        }
        assistantMessage.toolInvocations?.push(created)
        return created
      }

      while (!done) {
        const { value, done: readerDone } = await reader.read()
        done = readerDone
        if (value) {
          buffer += decoder.decode(value, { stream: true }).replaceAll('\r', '')

          // The agent respond() endpoint returns a UI Message stream using SSE:
          // each event is separated by a blank line and contains `data: <json>`.
          while (!streamDone) {
            const separatorIndex = buffer.indexOf('\n\n')
            if (separatorIndex === -1) break

            const rawEvent = buffer.slice(0, separatorIndex)
            buffer = buffer.slice(separatorIndex + 2)

            const dataLines = rawEvent
              .split('\n')
              .filter(l => l.startsWith('data:'))

            if (dataLines.length === 0) continue

            const data = dataLines
              .map(l => l.slice('data:'.length).trimStart())
              .join('\n')

            if (data === '[DONE]') {
              streamDone = true
              break
            }

            try {
              const chunk = JSON.parse(data)

              switch (chunk.type) {
                case 'text-delta':
                  assistantMessage.content += chunk.delta
                  break

                case 'tool-input-start':
                  console.debug('[chat] tool-input-start', chunk.toolName, chunk.toolCallId, Date.now(), chunk)
                  getOrCreateInvocation(chunk.toolCallId, chunk.toolName)
                  if (chunk.toolName === 'upsertScreen') {
                    setIsDesigning(true)
                  }
                  break

                case 'data-editing-start': {
                  // Custom event sent from server when we extract the screen ID from partial input
                  const screenId = chunk.data?.screenId
                  const toolCallId = chunk.data?.toolCallId
                  console.debug('[chat] data-editing-start', screenId, toolCallId, Date.now())
                  
                  if (typeof screenId === 'string' && typeof toolCallId === 'string') {
                    toolCallIdToScreenId.set(toolCallId, screenId)
                    setEditingScreenId(screenId)

                    // Ensure the canvas has a node to overlay immediately
                    upsertScreen(
                      { id: screenId, name: 'Designing...' },
                      { skipHistory: true },
                    )

                    await nextTick()
                  }
                  break
                }

                case 'tool-input-available': {
                  const invocation = getOrCreateInvocation(chunk.toolCallId, chunk.toolName)
                  invocation.args = chunk.input
                  invocation.state = 'call'

                  if (invocation.toolName === 'upsertScreen' && typeof chunk?.input?.id === 'string') {
                    toolCallIdToScreenId.set(chunk.toolCallId, chunk.input.id)
                    setEditingScreenId(chunk.input.id)

                    // Ensure the canvas has a node to overlay immediately, even if it's a new screen.
                    upsertScreen(
                      {
                        id: chunk.input.id,
                        name: typeof chunk?.input?.name === 'string' ? chunk.input.name : 'Untitled Screen',
                      },
                      { skipHistory: true },
                    )

                    // Allow Vue to mount the new ScreenNode and process the editingScreenId change
                    // before we continue processing more SSE events.
                    await nextTick()
                  }

                  console.debug('[chat] tool input', chunk.toolName, chunk.toolCallId, Date.now(), chunk.input)
                  break
                }

                case 'tool-output-available': {
                  const invocation = getOrCreateInvocation(chunk.toolCallId)
                  invocation.state = 'result'
                  invocation.result = chunk.output

                  console.debug('[chat] tool output', invocation.toolName, chunk.toolCallId, Date.now(), chunk.output)

                  // Trigger frontend side effects
                  if (invocation.toolName === 'upsertScreen') {
                    upsertScreen(invocation.result)
                    const screenId = toolCallIdToScreenId.get(chunk.toolCallId)
                    if (screenId) toolCallIdToScreenId.delete(chunk.toolCallId)
                    setEditingScreenId(null)
                    setIsDesigning(false)
                  } else if (invocation.toolName === 'restoreVersion') {
                    restoreVersion(invocation.result.index)
                  }
                  break
                }

                case 'tool-output-error': {
                  const invocation = getOrCreateInvocation(chunk.toolCallId)
                  invocation.state = 'error'
                  invocation.errorText = chunk.errorText

                  if (invocation.toolName === 'upsertScreen') {
                    const screenId = toolCallIdToScreenId.get(chunk.toolCallId)
                    if (screenId) toolCallIdToScreenId.delete(chunk.toolCallId)
                    setEditingScreenId(null)
                    setIsDesigning(false)
                  }
                  break
                }

                case 'error':
                  console.error('AI stream error:', chunk.errorText)
                  break
              }
            } catch (e) {
              console.error('Error parsing SSE chunk:', data, e)
            }
          }
        }

        if (streamDone) break
      }

      // Ensure the final assistant message content is part of subsequent requests.
      // The server expects assistant turns too (as UI messages with parts), so we must
      // capture what came back over the stream.
      assistantMessage.content = assistantMessage.content.trimEnd()
    } catch (e) {
      console.error('Chat error:', e)
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
    isLoading
  }
}
