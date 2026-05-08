import { arraySidebar } from "vuepress-theme-hope";
import { ICONS } from "./constants.js";

export const ai = arraySidebar([
  {
    text: "大模型基础",
    icon: ICONS.MACHINE_LEARNING,
    prefix: "llm-basis/",
    children: [
      { text: "万字拆解 LLM 运行机制", link: "llm-operation-mechanism" },
      { text: "大模型 API 调用工程实践", link: "llm-api-engineering" },
      { text: "AI 编程开放性面试题", link: "ai-ide" },
    ],
  },
  {
    text: "AI Agent",
    icon: ICONS.CHAT,
    prefix: "agent/",
    children: [
      { text: "AI Agent 核心概念详解", link: "agent-basis" },
      { text: "AI Agent 记忆系统详解", link: "agent-memory" },
      { text: "提示词工程实战指南", link: "prompt-engineering" },
      { text: "上下文工程实战指南", link: "context-engineering" },
      { text: "万字详解 Agent Skills", link: "skills" },
      { text: "万字拆解 MCP 协议", link: "mcp" },
      { text: "Harness Engineering 详解", link: "harness-engineering" },
      { text: "AI 工作流中详解", link: "workflow-graph-loop" },
    ],
  },
  {
    text: "RAG",
    icon: ICONS.SEARCH,
    prefix: "rag/",
    children: [
      { text: "万字详解 RAG 基础概念", link: "rag-basis" },
      {
        text: "万字详解 RAG 向量索引算法和向量数据库",
        link: "rag-vector-store",
      },
      { text: "万字详解 GraphRAG", link: "graphrag" },
      { text: "万字详解 RAG 检索优化", link: "rag-optimization" },
    ],
  },
  {
    text: "AI 编程实战",
    icon: ICONS.CODE,
    prefix: "ai-coding/",
    children: [
      {
        text: "AI 编程必备 Skills 推荐",
        link: "programmer-essential-skills",
      },
      {
        text: "IDEA + Qoder 插件多场景实战",
        link: "idea-qoder-plugin",
      },
      {
        text: "Trae + MiniMax 多场景实战",
        link: "trae-m2.7",
      },
      {
        text: "Claude Code 接入第三方模型实战",
        link: "cc-glm5.1",
      },
    ],
  },
  {
    text: "AI 编程技巧",
    icon: ICONS.TOOL,
    prefix: "ai-coding/",
    children: [
      {
        text: "Claude Code 使用指南",
        link: "claudecode-tips",
      },
      {
        text: "OpenAI Codex 最佳实践指南",
        link: "codex-best-practices",
      },
      {
        text: "OpenAI Codex Chrome 扩展",
        link: "codex-chrome-extension",
      },
    ],
  },
]);
