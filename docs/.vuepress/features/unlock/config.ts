import { PREVIEW_HEIGHT } from "./heights";

const withDefaultHeight = (
  paths: readonly string[],
  height: string = PREVIEW_HEIGHT.XXL,
): Record<string, string> =>
  Object.fromEntries(paths.map((path) => [path, height]));

export const unlockConfig = {
  // 版本号变更可强制用户重新验证
  unlockVersion: "v5",
  // 调试用：设为 true 时无视本地已解锁状态，始终触发限制
  forceLock: false,
  code: "8888",
  // 使用相对路径，图片放在 docs/.vuepress/public/images 下
  qrCodeUrl: "/images/qrcode-javaguide.jpg",
  // 路径 -> 可见高度（建议使用 PREVIEW_HEIGHT 预设）
  protectedPaths: {
    ...withDefaultHeight([
      "/java/jvm/memory-area.html",
      "/java/basis/java-basic-questions-02.html",
      "/java/collection/java-collection-questions-02.html",
      "/cs-basics/network/tcp-connection-and-disconnection.html",
      "/cs-basics/network/http-vs-https.html",
      "/cs-basics/network/dns.html",
      "/database/mysql/mysql-questions-01.html",
      "/high-performance/sql-optimization.html",
    ]),
    // 如需特殊高度，再单独覆盖
    // "/some/page.html": PREVIEW_HEIGHT.MEDIUM,
  },
} as const;

export { PREVIEW_HEIGHT };
