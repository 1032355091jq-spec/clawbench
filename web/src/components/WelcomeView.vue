<template>
  <div class="welcome-view" id="welcomeView">
    <FileText :size="60" :stroke-width="1.5" />
    <h2>{{ t('welcome.selectFile') }}</h2>
    <p>{{ t('welcome.description') }}</p>
  </div>
</template>

<script setup>
import { FileText } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<style scoped>
.welcome-view {
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 0;
    padding: 0 32px;
    text-align: center;
    color: var(--text-muted);
    border-radius: 0;
    background: transparent;
    box-sizing: border-box;
}

.welcome-view svg {
    width: 60px;
    height: 60px;
    margin-bottom: 20px;
    opacity: 0.4;
}

.welcome-view h2 {
    font-size: 20px;
    font-weight: 500;
    color: var(--text-secondary);
    margin-bottom: 8px;
}

.welcome-view p {
    font-size: 15px;
    max-width: 400px;
    margin-top: 8px;
}
</style>
