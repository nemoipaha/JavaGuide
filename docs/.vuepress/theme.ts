import { getDirname, path } from "vuepress/utils";
import { hopeTheme } from "vuepress-theme-hope";

import navbar from "./navbar.js";
import sidebar from "./sidebar/index.js";

const __dirname = getDirname(import.meta.url);
const docsearchAppId = process.env.DOCSEARCH_APP_ID;
const docsearchApiKey = process.env.DOCSEARCH_API_KEY;
const docsearchIndexName = process.env.DOCSEARCH_INDEX_NAME;
const docsearchOptions =
  docsearchAppId && docsearchApiKey && docsearchIndexName
    ? {
        appId: docsearchAppId,
        apiKey: docsearchApiKey,
        indexName: docsearchIndexName,
        locales: {
          "/": {
            placeholder: "搜索 JavaGuide",
          },
        },
      }
    : null;

export default hopeTheme({
  hostname: "https://javaguide.cn/",
  logo: "/logo.png",
  favicon: "/favicon.ico",

  author: {
    name: "Guide",
    url: "https://javaguide.cn/article/",
  },

  repo: "https://github.com/Snailclimb/JavaGuide",
  docsDir: "docs",
  pure: true,
  focus: false,
  print: false,
  breadcrumb: false,
  navbar,
  sidebar,
  footer:
    '<a href="https://beian.miit.gov.cn/" target="_blank">鄂ICP备2020015769号-1</a>',
  displayFooter: true,

  pageInfo: ["Author", "Category", "Tag", "Original", "Word", "ReadingTime"],

  blog: {
    intro: "/about-the-author/",
    medias: {
      Zhihu: "https://www.zhihu.com/people/javaguide",
      Github: "https://github.com/Snailclimb",
      Gitee: "https://gitee.com/SnailClimb",
    },
  },

  markdown: {
    align: true,
    codeTabs: true,
    mermaid: true,
    gfm: true,
    include: {
      resolvePath: (file, cwd) => {
        if (file.startsWith("@"))
          return path.resolve(
            __dirname,
            "../snippets",
            file.replace("@", "./"),
          );

        return path.resolve(cwd, file);
      },
    },
    tasklist: true,
  },

  plugins: {
    blog: true,
    sitemap: true,

    // The upstream copyright plugin can throw during hydration if `#app` is unavailable.
    // Keep it disabled until the plugin adds a null-safe mount path.
    copyright: false,

    feed: {
      atom: true,
      json: true,
      rss: true,
    },

    icon: {
      assets: "//at.alicdn.com/t/c/font_2922463_o9q9dxmps9.css",
    },

    photoSwipe: false,

    // 申请到 DocSearch key 后配置上面的环境变量；在此之前关闭本地搜索索引。
    ...(docsearchOptions ? { docsearch: docsearchOptions } : {}),
    search: false,
  },
});
