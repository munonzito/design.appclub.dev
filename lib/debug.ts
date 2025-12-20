/**
 * Debug Utility
 * 
 * Provides controllable logging for different parts of the application.
 * 
 * Usage:
 *   import { debug } from '~/lib/debug'
 *   debug.chat('tool input', data)
 * 
 * Enable in browser console:
 *   localStorage.debug = 'chat,tools,state'
 * 
 * Enable all:
 *   localStorage.debug = '*'
 * 
 * Disable:
 *   localStorage.removeItem('debug')
 */

type DebugNamespace = 'chat' | 'tools' | 'state' | 'stream' | 'render'

const COLORS: Record<DebugNamespace, string> = {
  chat: '#22c55e',   // green
  tools: '#3b82f6',  // blue
  state: '#f59e0b',  // amber
  stream: '#8b5cf6', // purple
  render: '#ec4899', // pink
}

function isEnabled(namespace: DebugNamespace): boolean {
  if (typeof window === 'undefined') {
    // Server-side: use NODE_ENV
    return process.env.NODE_ENV !== 'production'
  }

  // Client-side: check localStorage
  const debugSetting = localStorage.getItem('debug') || ''
  if (debugSetting === '*') return true
  return debugSetting.split(',').map(s => s.trim()).includes(namespace)
}

function createLogger(namespace: DebugNamespace) {
  return (...args: unknown[]) => {
    if (!isEnabled(namespace)) return

    const color = COLORS[namespace]
    const prefix = `%c[${namespace}]`
    const style = `color: ${color}; font-weight: bold;`

    console.log(prefix, style, ...args)
  }
}

export const debug = {
  chat: createLogger('chat'),
  tools: createLogger('tools'),
  state: createLogger('state'),
  stream: createLogger('stream'),
  render: createLogger('render'),
}

/**
 * Enable debug logging for specific namespaces.
 * Call from browser console: enableDebug('chat', 'tools')
 */
export function enableDebug(...namespaces: DebugNamespace[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem('debug', namespaces.join(','))
  console.log(`Debug enabled for: ${namespaces.join(', ')}`)
}

/**
 * Disable all debug logging.
 * Call from browser console: disableDebug()
 */
export function disableDebug() {
  if (typeof window === 'undefined') return
  localStorage.removeItem('debug')
  console.log('Debug disabled')
}

// Make helpers available globally in browser for easy access
if (typeof window !== 'undefined') {
  (window as any).enableDebug = enableDebug;
  (window as any).disableDebug = disableDebug;
}
