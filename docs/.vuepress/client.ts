import { defineClientConfig } from "vuepress/client";
import { h } from "vue";
import LayoutToggle from "./components/LayoutToggle.vue";
import UnlockContent from "./components/unlock/UnlockContent.vue";
import GlobalUnlock from "./components/unlock/GlobalUnlock.vue";

export default defineClientConfig({
  enhance({ app }) {
    // 注册手动解锁组件
    app.component("UnlockContent", UnlockContent);
  },
  rootComponents: [
    // 全局切换按钮
    () => h(LayoutToggle),
    // 全局扫码解锁控制器
    () => h(GlobalUnlock),
  ],
});
