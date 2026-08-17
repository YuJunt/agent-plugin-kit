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

# 打包 tarball 并闭环验证
node scripts/pack.js ./plugins/my-plugin -o ./dist
node scripts/pack.js ./plugins/my-plugin --dry-run          # 仅列出将打包的文件
node scripts/pack.js ./plugins/my-plugin --verify -o ./dist # 打包后解包并重新校验
node scripts/pack.js ./plugins/my-plugin --exclude 'docs/**' -o ./dist

# 安装到客户端插件目录（目录或 .tgz 均可；安装前自动校验）
node scripts/install.js ./plugins/my-plugin --target claude
node scripts/install.js ./dist/my-plugin-0.1.0.tgz --target /opt/agent-plugins
node scripts/install.js ./plugins/my-plugin --target claude --force  # 覆盖已安装版本

# 诊断环境：Node 版本、客户端目录、已装插件健康状态
node scripts/doctor.js                # 人类可读输出
node scripts/doctor.js --json         # 完整 JSON 报告
node scripts/doctor.js --target /opt/agent-plugins  # 追加扫描自定义目录

# Skill 内容质量 lint（客观指标：正文厚度、章节结构、列表/代码块、标题、未引用的捆绑文件）
node scripts/lint.js ./plugins/my-plugin    # 插件根目录或单个 skill 目录均可

# 指定 MCP 传输类型（stdio / streamable-http / sse）
node scripts/create.js my-plugin --mcp --mcp-type streamable-http --mcp-url https://example.com/mcp
```

也可以使用统一 CLI 入口：

```bash
node scripts/bin/agent-plugin.js create my-plugin --full -d ./plugins
node scripts/bin/agent-plugin.js validate ./plugins/my-plugin
node scripts/bin/agent-plugin.js pack ./plugins/my-plugin -o ./dist
node scripts/bin/agent-plugin.js install ./dist/my-plugin-0.1.0.tgz --target claude
node scripts/bin/agent-plugin.js doctor
node scripts/bin/agent-plugin.js lint ./plugins/my-plugin
```

## 校验能力

`validate` 覆盖 Agent Plugins 1.0.0 规范的关键约束：

- `plugin.json`：闭集字段、必填项、插件名约束（§5.2/5.5）、version semver 建议告警、extensions 与命名空间目录一致性、未来规范版本明确指引
- `skills/`：SKILL.md frontmatter、skill 命名与目录匹配、引用文件完整性、`allowed-tools` 校验、未知字段警告
- `mcp.json`：三传输类型（stdio/streamable-http/sse）、url 占位符一致性、路径与占位符约束、command 文件存在性
- 路径安全：`../` 逃逸与 symlink 逃逸检测（§4.1）
- 组件级失败隔离：单个组件无效不影响其他组件

## 质量保障

- 行为测试：`npm test`（覆盖 create/validate/pack/install/doctor/lint + 三示例插件 + strict/长路径/tar-slip/semver/glob/extensions/规范版本 回归）
- 契约测试：断言各脚本的 JSON 输出结构，防止静默破坏调用方；示例插件同时要求 lint 全清
- CI：GitHub Actions 在 Node 18/20/22（ubuntu/windows）上自动跑语法检查、测试、示例校验与打包闭环验证
- 发布：推送 `v*` tag 自动 npm publish + GitHub Release（附 tarball 与 sha256 校验和，见 [release.yml](.github/workflows/release.yml)）

## 项目结构

```text
SKILL.md                  # Skill 入口（frontmatter + 工作流指引）
scripts/
  create.js               # 脚手架生成引擎
  validate.js             # 规范验证引擎
  pack.js                 # tarball 打包引擎
  install.js              # 客户端安装引擎
  doctor.js               # 环境与已装插件诊断引擎
  lint.js                 # Skill 内容质量 lint（客观指标）
  lib/                    # 共享库（schema/约束/frontmatter/路径安全）
schemas/                  # plugin.json 与 mcp.json JSON Schema
references/               # 规范要点参考文档（progressive disclosure）
assets/templates/         # 脚手架模板（stdio/streamable-http/sse、server.js、LICENSE、CHANGELOG）
examples/                 # 真实示例插件
  hello-plugin/
  code-review-assistant/
  git-release-notes/
test/                     # 行为测试 + 契约测试
.github/workflows/        # CI
```

## 示例插件

- [examples/hello-plugin](examples/hello-plugin) — 最小示例（1 skill + stdio MCP）
- [examples/code-review-assistant](examples/code-review-assistant) — 代码审查助手（2 skills + git MCP）
- [examples/git-release-notes](examples/git-release-notes) — 发布说明生成器（2 skills + git 历史 MCP）

## 许可

[MIT](LICENSE)
