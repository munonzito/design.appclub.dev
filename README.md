This document serves as the comprehensive blueprint for building **Gemini Design Canvas**—a Figma-like web application where an AI agent designs mobile and desktop screens on an infinite canvas.

---

## 1. Project Overview

The application provides an AI-powered design environment. Users interact with a "Design Agent" via chat. The agent can create screens, modify their vanilla HTML/CSS, generate AI images for UI assets, and manage a version history for every screen.

### Core Features

* **Infinite Canvas:** A pan-and-zoom interface for a bird's-eye view of the entire project.
* **Shadow DOM Isolation:** Each screen is rendered in a Shadow Root to ensure CSS styles never leak or conflict.
* **Autonomous Agent Loop:** Powered by Vercel AI SDK, allowing the agent to chain multiple tool calls (e.g., "Generate image" \rightarrow "Update HTML").
* **Stateless Persistence:** In-memory versioning that saves "snapshots" of code for instant undos.

---

## 2. System Architecture

### Backend (Nitro / Vercel AI SDK)

The backend is a single Nitro API route (`/api/chat`) that acts as the agent's brain.

* **Model:** `gpt-4o` or similar.
* **Tooling:** A set of Zod-validated tools for `upsertScreen`, `restoreVersion`, and `generateImage`.
* **Max Steps:** Set to `5-10` to allow the agent to iterate on a design before showing the final result.

### Frontend (Nuxt 3)

* **State:** A global `useProjectState` composable.
* **UI:** A split view with a Chat Sidebar (Left) and the Infinite Canvas (Center/Right).

---

## 3. Technical Implementation Guides

### A. The Infinite Canvas (Zoom & Pan)

To create the Figma feel, we apply a global transform to a "Mover" container.

```vue
<script setup>
const transform = ref({ x: 0, y: 0, scale: 1 });

const handleWheel = (e) => {
  if (e.ctrlKey) { // Zoom
    const zoomSpeed = 0.001;
    transform.value.scale -= e.deltaY * zoomSpeed;
  } else { // Pan
    transform.value.x -= e.deltaX;
    transform.value.y -= e.deltaY;
  }
};
</script>

<template>
  <div class="canvas-viewport" @wheel.prevent="handleWheel">
    <div :style="{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})` }">
      <CanvasScreenNode v-for="s in screens" :screen="s" />
    </div>
  </div>
</template>

```

### B. Isolated Screen Rendering (Shadow DOM)

Standard `scoped` CSS isn't enough when an AI is writing raw CSS strings. We use the Shadow DOM to create a hard boundary.

```javascript
// Inside CanvasScreenNode.vue
const updateShadow = () => {
  const root = host.value.shadowRoot || host.value.attachShadow({ mode: 'open' });
  root.innerHTML = `
    <style>${props.screen.css}</style>
    <div class="wrapper">${props.screen.html}</div>
  `;
};

```

---

## 4. The Agent's Toolset (Low-Level)

| Tool | Action | Logic |
| --- | --- | --- |
| `upsertScreen` | Create/Edit | Pushes current `html/css` to `history[]` before updating current state. |
| `generateImage` | Asset Gen | Calls `experimental_generateImage` (DALL-E 3) and returns a URL. |
| `restoreVersion` | Undo | Replaces `html/css` with `history[index]`. |

### Image Generation Integration

The agent shouldn't just send an image; it should *place* it.

1. The agent calls `generateImage`.
2. The agent receives the URL.
3. The agent calls `upsertScreen` with `<img src="...">` included in the HTML.

---

## 5. File Structure

```text
/
├── components/
│   ├── Canvas/
│   │   ├── InfiniteStage.vue
│   │   └── ScreenNode.vue
│   └── Chat/
│       └── Sidebar.vue
├── server/
│   ├── api/
│   │   └── chat.post.ts      # The AI Agent Route
│   └── utils/
│       └── ai-tools.ts       # Tool definitions (Zod)
├── composables/
│   └── useProjectState.ts    # Global Screen & History state
└── lib/
    └── schemas.ts            # Shared types

```

---

## 6. Development Priorities (Roadmap)

1. **Phase 1:** Setup Nuxt + Vercel AI SDK basic chat.
2. **Phase 2:** Build the `InfiniteStage` and `ScreenNode` (Shadow DOM).
3. **Phase 3:** Implement the `upsertScreen` tool with "Next-to-each-other" auto-positioning.
4. **Phase 4:** Add the `history` array to the state and the `restoreVersion` tool.
5. **Phase 5:** Integrate the Image Generation tool for UI assets.