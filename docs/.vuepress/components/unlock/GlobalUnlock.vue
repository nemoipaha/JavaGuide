<template>
  <div v-if="isLockedPage && !isUnlocked" class="global-lock-root">
    <Teleport to="body">
      <div class="lock-overlay-container">
        <div class="lock-card">
          <div class="lock-header">
            <span class="lock-icon">🔒</span>
            <h3 class="lock-title">继续阅读全文</h3>
          </div>
          <p class="lock-reason">
            抱歉，由于近期遭受大规模爬虫攻击，为保障正常阅读体验，本站部分内容已开启一次性验证。验证后全站自动解锁。
          </p>
          <div class="qr-container">
            <img :src="config.qrCodeUrl" alt="公众号二维码" class="qr-image" />
            <p class="qr-tip">
              扫码/微信搜索关注
              <span class="highlight">JavaGuide</span> 官方公众号
            </p>
            <p class="qr-tip">
              回复 <span class="highlight">“验证码”</span> 获取
            </p>
          </div>
          <div class="input-wrapper">
            <input
              v-model="inputCode"
              type="text"
              placeholder="输入验证码"
              class="unlock-input"
              maxlength="4"
              @keyup.enter="handleUnlock"
            />
            <button class="unlock-btn" @click="handleUnlock">立即解锁</button>
          </div>
          <transition name="shake">
            <p v-if="showError" class="error-msg">验证码错误，请重试</p>
          </transition>
          <p class="lock-footer">感谢你的理解与支持</p>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { usePageData } from "vuepress/client";
import {
  PREVIEW_HEIGHT,
  unlockConfig as config,
} from "../../features/unlock/config";

const pageData = usePageData();
const isUnlocked = ref(false);
const inputCode = ref("");
const showError = ref(false);
const globalUnlockKey = `javaguide_site_unlocked_${config.unlockVersion ?? "v1"}`;

const normalizePath = (path: string) =>
  path.replace(/\/$/, "").replace(".html", "").toLowerCase();

const isLockedPage = computed(() => {
  const currentPath = normalizePath(pageData.value.path);
  return Object.keys(config.protectedPaths)
    .map((p) => normalizePath(p))
    .includes(currentPath);
});

const visibleHeight = computed(() => {
  const currentPath = normalizePath(pageData.value.path);
  const matched = Object.keys(config.protectedPaths).find(
    (p) => normalizePath(p) === currentPath,
  );
  return matched ? config.protectedPaths[matched] : PREVIEW_HEIGHT.LONG;
});

const readUnlockState = () => {
  if (typeof window === "undefined") return;
  isUnlocked.value = localStorage.getItem(globalUnlockKey) === "true";
};

const findContentSelector = () => {
  const selectors = [
    ".theme-hope-content",
    ".vp-content",
    ".content__default",
    ".vp-page-content",
    "article",
    "main",
  ];
  for (const selector of selectors) {
    if (document.querySelector(selector)) return selector;
  }
  return "main";
};

const applyLockStyle = () => {
  if (typeof document === "undefined") return;

  const styleId = "unlock-global-style";
  let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;

  if (isLockedPage.value && !isUnlocked.value) {
    const target = findContentSelector();
    const css = `
      ${target} {
        max-height: ${visibleHeight.value} !important;
        overflow: hidden !important;
        position: relative !important;
      }
      ${target}::after {
        content: "" !important;
        position: absolute !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        height: 160px !important;
        background: linear-gradient(to bottom, transparent, var(--bg-color, #fff)) !important;
        pointer-events: none !important;
        z-index: 90 !important;
      }
    `;

    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }
    styleEl.innerHTML = css;
  } else if (styleEl) {
    styleEl.innerHTML = "";
  }
};

const handleUnlock = () => {
  if (inputCode.value === config.code) {
    isUnlocked.value = true;
    localStorage.setItem(globalUnlockKey, "true");
    applyLockStyle();
  } else {
    showError.value = true;
    inputCode.value = "";
    setTimeout(() => {
      showError.value = false;
    }, 2000);
  }
};

onMounted(() => {
  readUnlockState();
  setTimeout(applyLockStyle, 80);
});

watch(
  () => pageData.value.path,
  () => {
    readUnlockState();
    setTimeout(applyLockStyle, 80);
  },
);
</script>

<style>
.lock-overlay-container {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 32px;
  z-index: 9999;
  display: flex;
  justify-content: center;
  pointer-events: none;
}

.lock-card {
  width: min(92vw, 480px);
  padding: 1.25rem;
  border-radius: 14px;
  border: 1px solid var(--border-color, #e5e7eb);
  background: var(--bg-color, #fff);
  box-shadow: 0 10px 32px rgba(0, 0, 0, 0.12);
  text-align: center;
  pointer-events: auto;
}

.lock-icon {
  font-size: 1.9rem;
}

.lock-title {
  margin: 0.35rem 0 0;
  font-size: 1.2rem;
}

.lock-reason {
  margin: 0.75rem 0 1rem;
  color: #64748b;
  line-height: 1.6;
}

.qr-container {
  margin: 0 auto 1rem;
  padding: 0.85rem;
  max-width: 300px;
  border: 1px dashed #3eaf7c;
  border-radius: 10px;
  background: #f8fafc;
}

.qr-image {
  width: 140px;
  height: 140px;
}

.qr-tip {
  margin: 0.45rem 0 0;
  font-size: 0.86rem;
}

.highlight {
  color: #3eaf7c;
  font-weight: 700;
}

.input-wrapper {
  display: flex;
  justify-content: center;
  gap: 0.55rem;
}

.unlock-input {
  width: 125px;
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  border: 1px solid #d1d5db;
  font-size: 1rem;
  text-align: center;
}

.unlock-btn {
  padding: 0.5rem 1rem;
  border: 0;
  border-radius: 8px;
  background: #3eaf7c;
  color: #fff;
  font-weight: 700;
  cursor: pointer;
}

.error-msg {
  margin: 0.45rem 0 0;
  color: #dc2626;
  font-size: 0.85rem;
}

.lock-footer {
  margin: 0.7rem 0 0;
  color: #94a3b8;
  font-size: 0.8rem;
}

.shake-enter-active {
  animation: shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
}

@keyframes shake {
  10%,
  90% {
    transform: translate3d(-1px, 0, 0);
  }
  20%,
  80% {
    transform: translate3d(2px, 0, 0);
  }
  30%,
  50%,
  70% {
    transform: translate3d(-4px, 0, 0);
  }
  40%,
  60% {
    transform: translate3d(4px, 0, 0);
  }
}

@media (max-width: 576px) {
  .input-wrapper {
    flex-direction: column;
    align-items: center;
  }

  .unlock-input,
  .unlock-btn {
    width: min(220px, 80vw);
  }
}
</style>
