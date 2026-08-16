# Agent Plugin Kit

一个以 **Agent Skill** 形态交付的 Agent Plugins 开发工具。让 AI 助手按照 [Agent Plugins 1.0.0 规范](https://agent-plugins.org/specification) 创建、验证、打包可跨客户端移植的插件（Agent Skills + MCP servers）。

## 安装

将本仓库目录（或副本）放入你的 AI 客户端的 skills 目录即可使用。例如：

- **Claude Code**: `~/.claude/skills/`
- **Cursor**: `.cursor/skills/`
- **其他支持 Agent Skills 的客户端**: 按对应目录放置

要求 Node.js >= 18（脚本仅使用内置模块，零依赖）。

## 使用方式

激活本 skill 后，AI 助手可通过以下命令操作：

```bash
# 创建插件骨架（完整模式：manifest + skills + MCP server 存根 + LICENSE + CHANGELOG）
node scripts/create.js my-plugin --full -d ./plugins

# 指定 skill 名称，可多个
node scripts/create.js my-plugin --full --skill analyze --skill report -d ./plugins

# 仅含技能或仅含 MCP
node scripts/create.js my-plugin --skills --skill summarize -d ./plugins
node scripts/create.js my-plugin --mcp -d ./plugins

# 校验插件是否符合规范
node scripts/validate.js ./plugins/my-plugin --json

# 打包为可分发 tarball
node scripts/pack.js ./plugins/my-plugin -o ./dist
```

也可以使用统一 CLI 入口：

```bash
node scripts/bin/agent-plugin.js create my-plugin --full -d ./plugins
node scripts/bin/agent-plugin.js validate ./plugins/my-plugin
node scripts/bin/agent-plugin.js pack ./plugins/my-plugin -o ./dist
```

## 校验能力

`validate` 覆盖 Agent Plugins 1.0.0 规范的关键约束：

- `plugin.json`：闭集字段、必填项、插件名约束（§5.2/5.5）
- `skills/`：SKILL.md frontmatter、skill 命名与目录匹配、引用文件完整性
- `mcp.json`：三传输类型（stdio/streamable-http/sse）、路径与占位符约束、command 文件存在性
- 路径安全：`../` 逃逸与 symlink 逃逸检测（§4.1）
- 组件级失败隔离：单个组件无效不影响其他组件

## 项目结构

```text
SKILL.md                  # Skill 入口（frontmatter + 工作流指引）
scripts/
  create.js               # 脚手架生成引擎
  validate.js             # 规范验证引擎
  pack.js                 # tarball 打包引擎
  lib/                    # 共享库（schema/约束/frontmatter/路径安全）
schemas/                  # plugin.json 与 mcp.json JSON Schema
references/               # 规范要点参考文档（progressive disclosure）
assets/templates/         # 脚手架模板
examples/                 # 真实示例插件
  hello-plugin/
  code-review-assistant/
  git-release-notes/
```

## 示例插件

- [examples/hello-plugin](examples/hello-plugin) — 最小示例（1 skill + stdio MCP）
- [examples/code-review-assistant](examples/code-review-assistant) — 代码审查助手（2 skills + git MCP）
- [examples/git-release-notes](examples/git-release-notes) — 发布说明生成器（2 skills + git 历史 MCP）

## 许可

[MIT](LICENSE)
