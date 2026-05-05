<template>
  <div class="video-preview-container">
    <div class="video-preview-body">
      <video
        ref="videoRef"
        :src="mediaUrl"
        controls
        class="video-player"
        @loadedmetadata="onLoaded"
      >
        {{ t('media.videoNotSupported') }}
      </video>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({
    file: Object,
})

// Cache-busting: update timestamp when file changes to bust browser cache
const mediaTimestamp = ref(Date.now())
watch(() => props.file, () => { mediaTimestamp.value = Date.now() })
const mediaUrl = computed(() =>
    `/api/local-file/${encodeURIComponent(props.file.path)}?t=${mediaTimestamp.value}`
)

const videoRef = ref(null)

function onLoaded() {
    // Video is ready to play
}
</script>

<style scoped>
.video-preview-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 0;
}

.video-preview-body {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background: #000;
}

.video-player {
    max-width: 100%;
    max-height: 100%;
    border-radius: var(--radius-sm);
    outline: none;
}
</style>
