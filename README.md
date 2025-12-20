# App Club Design

**AI-powered design canvas for creating mobile and desktop UI screens**

A Figma-like web application where an AI agent designs screens on an infinite canvas. Built with Nuxt 3, Vercel AI SDK v5, and Azure OpenAI.

🔗 **Repository:** https://github.com/munonzito/design.appclub.dev

---

## Features

- ✨ **AI Design Agent** - Chat with an AI that creates and edits UI screens in real-time
- 🎨 **Infinite Canvas** - Pan and zoom with smooth transformations (Ctrl/Cmd + wheel to zoom, Shift + wheel to pan)
- 📱 **Screen Rendering** - Sandboxed iframe rendering for complete HTML/CSS isolation
- 🔄 **Streaming Tool Calls** - Real-time feedback as the agent designs (editing overlays, progress indicators)
- 📊 **Version History** - Track changes and restore previous versions of screens
- 🎯 **Keyboard Shortcuts** - Zoom in/out with `Cmd/Ctrl +` and `Cmd/Ctrl -`
- 🐛 **Debug Utility** - Controllable namespace-based logging for development

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) v1.0+
- Azure OpenAI API access

### Installation

1. Clone the repository:
```bash
git clone https://github.com/munonzito/design.appclub.dev.git
cd design.appclub.dev
```

2. Install dependencies:
```bash
bun install
```

3. Create `.env` file from template:
```bash
cp .env.example .env
```

4. Add your API keys to `.env`:
```bash
AZURE_API_KEY=your_azure_api_key_here
# Optional: GOOGLE_GENERATIVE_AI_API_KEY=your_google_key_here
```

5. Start the development server:
```bash
bun run dev
```

6. Open http://localhost:3000 and start designing!

### Build for Production

```bash
bun run build
bun run preview
```

---

## Architecture

### Tech Stack

- **Framework:** [Nuxt 3](https://nuxt.com/) with TypeScript
- **AI SDK:** [Vercel AI SDK v5](https://sdk.vercel.ai/) with Agent class
- **Model:** Azure OpenAI (gpt-4o)
- **Styling:** Tailwind CSS with custom brutalist design system
- **Rendering:** Sandboxed iframe with HTML sanitization

### Project Structure

```
/
├── components/
│   ├── Canvas/
│   │   ├── InfiniteStage.vue      # Pan/zoom canvas with keyboard shortcuts
│   │   └── ScreenNode.vue         # Iframe renderer with editing overlay
│   └── Chat/
│       └── Sidebar.vue            # Chat UI with tool status indicators
├── composables/
│   ├── useChatAgent.ts            # Chat orchestration (~100 lines)
│   ├── useProjectState.ts         # Global state (screens, history, editing)
│   └── chat/
│       ├── types.ts               # Message and ToolInvocation types
│       ├── parseSSEStream.ts      # SSE parser for AI SDK streams
│       └── handleToolEvents.ts    # Tool event routing and side effects
├── server/
│   ├── api/
│   │   └── chat.post.ts           # Agent streaming endpoint
│   └── utils/
│       ├── designAgent.ts         # Agent factory + system prompt
│       └── ai-tools.ts            # Tool definitions (upsertScreen, listScreens, etc.)
├── lib/
│   ├── debug.ts                   # Controllable debug utility
│   └── schemas.ts                 # Zod schemas for screens
└── docs/
    └── AI_SDK_INTEGRATION.md      # Comprehensive AI SDK integration guide
```

### Key Design Decisions

**1. Iframe Rendering (Not Shadow DOM)**
- Agent generates full HTML documents with `<html>`, `<body>`, global CSS
- Sandboxed iframe provides complete isolation
- HTML sanitization removes `<script>` and `<link>` tags for security

**2. Modular Composables**
- `useChatAgent.ts` orchestrates chat but delegates to focused modules:
  - `parseSSEStream.ts` - Reusable SSE parser
  - `handleToolEvents.ts` - Tool event routing
  - `types.ts` - Shared message types
- Easier to test, maintain, and extend

**3. Custom Streaming for Early Feedback**
- Uses `createUIMessageStream` wrapper to send custom events
- `onInputDelta` hook parses screen ID from partial JSON as it streams
- Sends `data-editing-start` event before tool execution completes
- Result: Editing overlay appears immediately when agent starts designing

**4. Controllable Debug Logging**
- Production: Silent by default
- Development: Enable via browser console: `enableDebug('tools', 'state', 'render')`
- Color-coded output for easy filtering

---

## AI SDK Integration

This project uses advanced AI SDK v5 patterns including:

- **Agent Class** with multi-step reasoning
- **UIMessage Streaming** with SSE protocol
- **Custom Tool Lifecycle Hooks** (`onInputDelta`)
- **Early Feedback Mechanism** for better UX

For detailed technical documentation, see [docs/AI_SDK_INTEGRATION.md](./docs/AI_SDK_INTEGRATION.md)

---

## Development

### Debug Logging

Enable debug logs in the browser console:

```javascript
enableDebug('tools')    // Tool call lifecycle
enableDebug('state')    // State changes (isDesigning, editingScreenId)
enableDebug('render')   // Rendering events (overlay ON/OFF)
enableDebug('stream')   // SSE stream parsing
enableDebug('chat')     // Chat messages

// Or enable multiple:
enableDebug('tools', 'state', 'render')
```

### Environment Variables

- `AZURE_API_KEY` - Azure OpenAI API key (required)
- `GOOGLE_GENERATIVE_AI_API_KEY` - Google AI API key (optional, alternative provider)

### Building

```bash
bun run build              # Build for production
bun run preview            # Preview production build
bun run generate           # Generate static site
```

---

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables:
   - `AZURE_API_KEY`
4. Deploy

### Netlify

1. Build command: `bun run build`
2. Publish directory: `.output/public`
3. Add environment variables

---

## License

MIT