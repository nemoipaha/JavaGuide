import { defineClientConfig } from "vuepress/client";
import { defineAsyncComponent, h } from "vue";
import DeferredLayoutToggle from "./components/DeferredLayoutToggle.vue";
import LazyMermaid from "./components/LazyMermaid.vue";
import GlobalUnlock from "./components/unlock/GlobalUnlock.vue";

const UnlockContent = defineAsyncComponent(
  () => import("./components/unlock/UnlockContent.vue"),
);

export default defineClientConfig({
  enhance({ app }) {
    app.component("Mermaid", LazyMermaid);
    app.component("UnlockContent", UnlockContent);
  },
  rootComponents: [() => h(DeferredLayoutToggle), () => h(GlobalUnlock)],
});
