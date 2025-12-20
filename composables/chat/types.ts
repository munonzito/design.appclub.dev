/**
 * Chat message types for the design agent.
 * 
 * Note: These are our internal types. The AI SDK uses UIMessage/ModelMessage
 * which have different shapes. See docs/AI_SDK_INTEGRATION.md for details.
 */

export interface ToolInvocation {
  toolCallId: string
  toolName?: string
  state: 'call' | 'result' | 'error'
  args?: unknown
  result?: unknown
  errorText?: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'tool'
  content: string
  toolInvocations?: ToolInvocation[]
}

/**
 * AI SDK UIMessage format - what we send to the server.
 * The server expects messages with { id, role, parts: [{ type: 'text', text }] }
 */
export interface UIMessagePayload {
  id: string
  role: 'user' | 'assistant'
  parts: Array<{ type: 'text'; text: string }>
}
