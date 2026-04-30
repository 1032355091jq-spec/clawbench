<template>
  <span
    ref="wrapperRef"
    class="hm-wrapper"
    :class="{ 'hm-scrolling': isScrolling }"
    :title="title || text"
  >
    <span class="hm-inner">
      <span ref="textRef" class="hm-text"><slot /></span>
      <span v-if="isScrolling" class="hm-text hm-text-copy"><slot /></span>
    </span>
  </span>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'

const props = defineProps({
  text: { type: String, default: '' },
  title: { type: String, default: '' },
})

const wrapperRef = ref(null)
const textRef = ref(null)
const isScrolling = ref(false)

let ro = null

function checkOverflow() {
  if (!wrapperRef.value || !textRef.value) return
  const wrapperWidth = wrapperRef.value.offsetWidth
  const textWidth = textRef.value.offsetWidth
  // Only enable marquee when single copy of text overflows
  isScrolling.value = textWidth > wrapperWidth - 8 // subtract padding-left
}

onMounted(() => {
  checkOverflow()
  ro = new ResizeObserver(checkOverflow)
  if (wrapperRef.value) ro.observe(wrapperRef.value)
  if (textRef.value) ro.observe(textRef.value)
})

onBeforeUnmount(() => {
  ro?.disconnect()
})

// Re-check when text changes
watch(() => props.text, async () => {
  await nextTick()
  checkOverflow()
})
</script>

<style>
.hm-wrapper {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  overflow: hidden;
  padding-left: 8px;
  width: 100%;
  max-width: 100%;
}

.hm-inner {
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
}

.hm-text {
  display: inline-block;
  white-space: nowrap;
  flex-shrink: 0;
}

/* Scrolling state: animate the inner track */
.hm-wrapper.hm-scrolling .hm-inner {
  animation: hm-marquee 8s linear infinite;
}

.hm-wrapper.hm-scrolling:hover .hm-inner {
  animation-play-state: paused;
}

.hm-text-copy {
  padding-left: 3em; /* gap between copies */
}

@keyframes hm-marquee {
  0% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(-50%);
  }
}
</style>
