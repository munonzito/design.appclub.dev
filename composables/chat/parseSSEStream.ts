/**
 * SSE Stream Parser for AI SDK UI Message Stream Protocol.
 * 
 * The AI SDK streams responses using Server-Sent Events (SSE) format:
 * - Each event is separated by a blank line (\n\n)
 * - Each line starts with "data: " followed by JSON
 * - Stream ends with "data: [DONE]"
 * 
 * Event types we handle:
 * - text-delta: Streaming text content
 * - tool-input-start: Tool call initiated (no args yet)
 * - tool-input-available: Tool args fully streamed
 * - tool-output-available: Tool execution completed
 * - tool-output-error: Tool execution failed
 * - data-*: Custom data events (e.g., data-editing-start)
 * - error: Stream error
 * 
 * @see https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol
 */

export interface SSEChunk {
  type: string
  [key: string]: unknown
}

export interface ParseSSEStreamOptions {
  onChunk: (chunk: SSEChunk) => void | Promise<void>
  onError?: (error: Error) => void
  onDone?: () => void
}

/**
 * Parses an SSE stream from the AI SDK and calls handlers for each chunk.
 */
export async function parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  options: ParseSSEStreamOptions
): Promise<void> {
  const { onChunk, onError, onDone } = options
  const decoder = new TextDecoder()
  
  let buffer = ''
  let done = false
  let streamDone = false

  while (!done) {
    const { value, done: readerDone } = await reader.read()
    done = readerDone

    if (value) {
      // Normalize line endings (some servers send \r\n)
      buffer += decoder.decode(value, { stream: true }).replaceAll('\r', '')

      // Process complete events (separated by blank lines)
      while (!streamDone) {
        const separatorIndex = buffer.indexOf('\n\n')
        if (separatorIndex === -1) break

        const rawEvent = buffer.slice(0, separatorIndex)
        buffer = buffer.slice(separatorIndex + 2)

        // Extract data lines (SSE format: "data: <content>")
        const dataLines = rawEvent
          .split('\n')
          .filter(l => l.startsWith('data:'))

        if (dataLines.length === 0) continue

        const data = dataLines
          .map(l => l.slice('data:'.length).trimStart())
          .join('\n')

        // Check for stream termination
        if (data === '[DONE]') {
          streamDone = true
          break
        }

        // Parse and handle the chunk
        try {
          const chunk = JSON.parse(data) as SSEChunk
          await onChunk(chunk)
        } catch (e) {
          onError?.(new Error(`Failed to parse SSE chunk: ${data}`))
        }
      }
    }

    if (streamDone) break
  }

  onDone?.()
}
