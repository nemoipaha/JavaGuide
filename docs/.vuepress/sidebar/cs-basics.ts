import { ICONS, createImportantSection } from "./constants.js";

export const csBasics = [
  {
    text: "网络",
    prefix: "network/",
    icon: ICONS.NETWORK,
    children: [
      {
        text: "面试题",
        icon: ICONS.INTERVIEW,
        children: [
          "other-network-questions",
          "other-network-questions2",
          // "computer-network-xiexiren-summary",
        ],
      },
      {
        text: "重点",
        icon: ICONS.STAR,
        children: [
          "osi-and-tcp-ip-model",
          "the-whole-process-of-accessing-web-pages",
        ],
      },
      {
        text: "应用层",
        icon: ICONS.CODE,
        children: [
          "application-layer-protocol",
          "http-vs-https",
          "http1.0-vs-http1.1",
          "http-status-codes",
          "dns",
        ],
      },
      {
        text: "传输层",
        icon: ICONS.NETWORK,
        children: [
          "tcp-connection-and-disconnection",
          "tcp-reliability-guarantee",
        ],
      },
      {
        text: "网络层",
        icon: ICONS.NETWORK,
        children: ["arp", "nat"],
      },
      {
        text: "安全",
        icon: ICONS.SECURITY,
        children: ["network-attack-means"],
      },
    ],
  },
  {
    text: "操作系统",
    prefix: "operating-system/",
    icon: ICONS.OS,
    children: [
      "operating-system-basic-questions-01",
      "operating-system-basic-questions-02",
      {
        text: "Linux",
        icon: ICONS.LINUX,
        children: ["linux-intro", "shell-intro"],
      },
    ],
  },
  {
    text: "数据结构",
    prefix: "data-structure/",
    icon: ICONS.DATA_STRUCTURE,
    children: [
      "linear-data-structure",
      "tree",
      "graph",
      "heap",
      "red-black-tree",
      "bloom-filter",
    ],
  },
  {
    text: "算法",
    prefix: "algorithms/",
    icon: ICONS.ALGORITHM,
    children: [
      "classical-algorithm-problems-recommendations",
      "common-data-structures-leetcode-recommendations",
      "string-algorithm-problems",
      "linkedlist-algorithm-problems",
      "the-sword-refers-to-offer",
      "10-classical-sorting-algorithms",
    ],
  },
];
