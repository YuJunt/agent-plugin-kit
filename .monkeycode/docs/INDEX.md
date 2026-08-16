# Agent Plugin Kit 文档

## 项目概述

Agent Plugin Kit 是一个以 **Agent Skill** 形态交付的 Agent Plugins 开发工具。它将 Agent Plugins 1.0.0 规范知识、脚手架生成、规范验证、打包分发能力封装为一个可安装到任意支持 Agent Skills 的 AI 客户端（Claude Code、Cursor、Codex、VS Code 等）的 Skill，并内嵌多个可执行脚本与引擎，让 AI 助手能够按照规范快速创建、校验、打包 Agent Plugins。

**目标用户**: 需要为 AI 智能体开发 Skills / MCP 服务器扩展的开发者，以及想要在 AI 客户端中批量产出符合规范的 Agent Plugins 的个人或团队。

**核心价值**:
- **一次打包，到处运行**：Skill 本身就是开放标准，天然跨客户端，无需针对不同平台适配
- **规范即代码**：将 Agent Plugins 1.0.0 规范中可确定性的约束（字段、命名、路径安全、MCP 配置）固化为可执行校验脚本，消除 LLM 手工操作的不确定性
- **AI 原生工作流**：开发者在对话中直接使用 AI 创建插件，Skill 提供完整的模板、参考文档和验证反馈循环

## 技术选型

| 类别 | 选择 | 理由 |
|------|------|------|
| Skill 规范 | Agent Skills Specification | 开放标准，被主流 AI 客户端原生支持，天然可移植 |
| 目标规范 | Agent Plugins 1.0.0 | 六巨头（OpenAI/微软/谷歌/亚马逊/Cursor/Vercel）联合发布的插件打包标准 |
| 脚本引擎 | Node.js (>= 18) | 环境普遍可用、自带 JSON 解析、无需额外依赖即可运行校验脚本 |
| 校验实现 | 自研 JSON Schema 校验器 + 规范约束检查 | 避免引入运行时依赖，可精确实现规范中 JSON Schema 无法表达的约束（如路径逃逸检查） |
| 打包格式 | 自定义 tarball 打包器（纯 Node 实现） | 零依赖生成 `.tgz`，符合规范的分发单元 |

## 核心功能

### Skill 指导层（SKILL.md）
- **目的**: 让 AI 助手掌握创建 Agent Plugins 所需的规范知识和工作流程
- **描述**: 提供完整的分步指引，覆盖插件目录结构、manifest 编写、Skill 组件开发、MCP 服务器配置、扩展命名空间、环境变量约定，以及可调用的内嵌脚本说明。遵循 progressive disclosure，主文件保持精简，详细规范拆入 references/。

### 脚手架生成引擎（scripts/create.js）
- **目的**: 一键生成符合规范的插件目录骨架
- **描述**: 接收插件名与选项，生成 plugin.json（含完整元数据字段模板）、skills/ 目录结构、mcp.json 模板，并自动校验插件名合法性。支持仅插件、插件+Skill、插件+MCP、完整三种预设。

### 规范验证引擎（scripts/validate.js）
- **目的**: 完整校验插件是否符合 Agent Plugins 1.0.0 规范
- **描述**: 校验 plugin.json（闭集字段、必填项、插件名约束、未知字段报告）、mcp.json（schema、服务器条目、路径/占位符/URL 约束）、skills/（SKILL.md frontmatter、名称、目录结构），并执行路径逃逸安全检查。输出结构化结果，按组件类型隔离失败边界。

### 打包引擎（scripts/pack.js）
- **目的**: 将插件打包为可分发的 tarball
- **描述**: 生成 `.tgz`，包含标准目录结构、规范版本标识和校验信息清单，供分发给任意兼容客户端。

### 参考文档层（references/）
- **目的**: 提供 AI 助手按需加载的详细规范知识
- **描述**: 拆分为 plugin 规范要点、SKILL.md 编写规范、MCP 配置规范、路径与安全规则、故障排查等聚焦文件，避免主文件臃肿。

## 文档导航

- [架构设计](./ARCHITECTURE.md) - 系统架构和技术设计
- [接口定义](./INTERFACES.md) - 脚本接口和交互规范
- [开发指南](./DEVELOPER_GUIDE.md) - 开发环境和规范
