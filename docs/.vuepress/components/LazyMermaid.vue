<template>
  <component
    :is="MermaidComponent"
    v-if="shouldRender && MermaidComponent"
    :code="code"
    :title="title"
  />
  <div v-else ref="placeholderEl" class="mermaid-lazy-placeholder">
    <span class="mermaid-lazy-spinner" aria-hidden="true" />
    <span>图表加载中</span>
  </div>
</template>

<script setup lang="ts">
import { markRaw, onBeforeUnmount, onMounted, shallowRef } from "vue";
import type { Component } from "vue";

defineProps<{
  code: string;
  title?: string;
}>();

const placeholderEl = shallowRef<HTMLElement | null>(null);
const shouldRender = shallowRef(false);
const MermaidComponent = shallowRef<Component | null>(null);
let observer: IntersectionObserver | null = null;

const loadMermaidComponent = async () => {
  if (MermaidComponent.value) return;

  const { default: Mermaid } = await import(
    "@vuepress/plugin-markdown-chart/client/components/Mermaid.js"
  );
  MermaidComponent.value = markRaw(Mermaid);
};

const renderWhenVisible = () => {
  shouldRender.value = true;
  observer?.disconnect();
  observer = null;
  void loadMermaidComponent();
};

onMounted(() => {
  if (!placeholderEl.value) return;

  if (!("IntersectionObserver" in window)) {
    renderWhenVisible();
    return;
  }

  observer = new IntersectionObserver(
    ([entry]) => {
      if (entry?.isIntersecting) renderWhenVisible();
    },
    {
      rootMargin: "800px 0px",
    },
  );
  observer.observe(placeholderEl.value);
});

onBeforeUnmount(() => {
  observer?.disconnect();
});
</script>

<style scoped>
.mermaid-lazy-placeholder {
  display: flex;
  min-height: 120px;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  margin: 0.6em 0;
  color: var(--vp-c-text-mute);
  font-size: 0.9rem;
}

.mermaid-lazy-spinner {
  width: 1rem;
  height: 1rem;
  border: 2px solid var(--vp-c-divider);
  border-top-color: var(--vp-c-accent-bg);
  border-radius: 50%;
  animation: mermaid-lazy-spin 0.8s linear infinite;
}

@keyframes mermaid-lazy-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
