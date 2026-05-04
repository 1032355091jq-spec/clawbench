# Session Swipe Position Indicator Design

## Overview

Add a position indicator below the existing session title indicator when swiping between sessions. Shows dots bar (<=15 sessions) or capsule progress bar (>15 sessions), always with a numeric label (e.g. `3/7`).

## Visual Design

### Two-row layout (inside existing `.session-switch-indicator`)

```
Row 1 (existing): [<- arrow] [session title]
Row 2 (new):      [dots/capsule] [3/7]
```

### Dots bar (<=15 sessions)

- Current session: filled dot, 6px, theme color
- Other sessions: small dot, 4px, gray semi-transparent
- Spacing: 4px between dots, centered
- Animation: discrete jump - old position dot shrinks/fades, new position dot grows/brightens, 150ms ease-out

### Capsule progress bar (>15 sessions)

- Track: rounded rect, 80px wide, 3px tall, gray semi-transparent
- Slider: rounded bar, theme color, width = `80px / total` (min 6px), position offset proportional
- Animation: smooth slide from old to new position, 200ms ease-out

### Numeric label

- Format: `current/total` (1-based, e.g. `3/7`)
- Style: 10px font, gray, right of dots/capsule with 4px gap

## Display Timing

- Appears and disappears in sync with existing title indicator
- Controlled by `indicatorText` ref (existing behavior)
- Auto-clears after 1500ms (existing timeout)

## Data Model Changes

### useSwipeSession.ts

New exports:
```typescript
const sessionIndex = ref(-1)   // current session position in cached list (0-based)
const sessionTotal = ref(0)    // total session count
```

Update logic:
- After `fetchSessions()` resolves: find `currentSessionId` in the list, set `sessionIndex` and `sessionTotal`
- After `swipeToNext()`/`swipeToPrev()` succeeds: `currentSessionId` changes, recalculate `sessionIndex`

## Template Changes

### ChatPanel.vue

Restructure indicator from flat to two-row:

```html
<div v-if="swipeSession.indicatorText.value" class="session-switch-indicator"
     :class="swipeSession.indicatorDirection.value">
  <!-- Row 1: existing arrow + title -->
  <div class="session-indicator-row">
    <div class="session-indicator-arrow">...</div>
    <span class="session-indicator-text">{{ swipeSession.indicatorText.value }}</span>
  </div>
  <!-- Row 2: position indicator -->
  <div v-if="showPositionIndicator" class="session-indicator-position">
    <div v-if="sessionTotal <= 15" class="session-dots">
      <span v-for="i in sessionTotal" :key="i"
            class="session-dot" :class="{ active: i - 1 === sessionIndex }" />
    </div>
    <div v-else class="session-capsule">
      <div class="session-capsule-track">
        <div class="session-capsule-slider" :style="capsuleStyle" />
      </div>
    </div>
    <span class="session-position-count">{{ sessionIndex + 1 }}/{{ sessionTotal }}</span>
  </div>
</div>
```

Computed:
- `showPositionIndicator`: `sessionIndex >= 0 && sessionTotal > 1`
- `capsuleStyle`: calculates slider width and left offset based on `sessionIndex/sessionTotal`

## Edge Cases

- Only 1 session: don't show row 2 (no meaningful position info)
- Session list empty: don't show row 2
- Current session not in list (e.g. just created, cache stale): `sessionIndex = -1`, don't show row 2
- Cache expires during swipe: `fetchSessions()` auto-refreshes, index computed from fresh list

## Files Changed

| File | Change |
|------|--------|
| `web/src/composables/useSwipeSession.ts` | Add `sessionIndex`, `sessionTotal` refs; update after fetch and switch |
| `web/src/components/chat/ChatPanel.vue` | Restructure indicator HTML to two rows; add dots/capsule template and styles |

## Out of Scope

- No separate component file (logic is simple, inline in ChatPanel)
- No real-time finger tracking (discrete jumps match threshold-trigger logic)
- No tap/drag on dots to jump to a specific session
