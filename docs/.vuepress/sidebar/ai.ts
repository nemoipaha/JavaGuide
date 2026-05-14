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
      {
        text: "大模型结构化输出详解",
        link: "structured-output-function-calling",
      },
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
      { text: "AI 工作流详解", link: "workflow-graph-loop" },
    ],
  },
  {
    text: "RAG",
    icon: ICONS.SEARCH,
    prefix: "rag/",
    children: [
      { text: "RAG 基础概念详解", link: "rag-basis" },
      {
        text: "RAG 文档处理与切分策略",
        link: "rag-document-processing",
      },
      {
        text: "RAG 向量索引算法和向量数据库",
        link: "rag-vector-store",
      },
      {
        text: "RAG 知识库文档更新策略",
        link: "rag-knowledge-update",
      },
      { text: "GraphRAG 详解", link: "graphrag" },
      { text: "RAG 检索优化", link: "rag-optimization" },
    ],
  },
]);
