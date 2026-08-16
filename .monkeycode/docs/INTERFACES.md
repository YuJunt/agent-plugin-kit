# 接口定义

## 脚本引擎接口

所有脚本为 Node.js 可执行文件，通过 `node <script> <args>` 调用。脚本输出采用结构化格式（JSON），便于 AI 助手解析。以下为与 AI 助手交互的核心接口。

### create.js — 脚手架生成

创建符合 Agent Plugins 1.0.0 规范的插件目录骨架。

```
node scripts/create.js <plugin-name> [options]
```

**参数**

| 参数 | 说明 |
|------|------|
| `plugin-name` | 插件名，须满足规范 §5.5 命名约束（1-64 字符，小写字母数字 `-` `.`，字母数字起止，无连续符号） |
| `-s, --skills` | 包含 skills/ 目录及 SKILL.md 模板 |
| `-m, --mcp` | 包含 mcp.json 模板 |
| `--full` | 完整骨架（plugin.json 全字段 + skills + mcp.json + LICENSE） |
| `--minimal` | 最小骨架（仅 plugin.json 与 skills/ 占位） |
| `-d, --dir <path>` | 输出目录，默认当前目录 |
| `--no-input` | 非交互模式 |

**输出**

```
{"created": true, "root": "<abs-path>", "files": ["plugin.json", "..."]}
```

或错误：

```
{"created": false, "errors": [{"field": "name", "message": "..."}]}
```

### validate.js — 规范验证

对插件目录执行完整规范校验。

```
node scripts/validate.js <plugin-root> [--json] [--strict]
```

**参数**

| 参数 | 说明 |
|------|------|
| `plugin-root` | 插件根目录路径 |
| `--json` | 输出完整 JSON 报告（默认精简输出） |
| `--strict` | 将警告（warning）计为失败 |

**输出**（JSON 报告结构）

```json
{
  "valid": false,
  "summary": {"errors": 2, "warnings": 1},
  "manifest": {"valid": true, "errors": [], "warnings": []},
  "skills": [
    {"name": "summarize", "valid": false, "errors": [{"message": "..."}], "warnings": []}
  ],
  "mcp": {"valid": true, "servers": [{"name": "server", "valid": true, "errors": []}]},
  "pathSafety": {"valid": true}
}
```

校验维度：

| 维度 | 说明 | 失败边界 |
|------|------|---------|
| manifest | plugin.json 闭集字段、必填项、类型、命名约束 | 致命：拒绝插件 |
| skills | SKILL.md frontmatter、名称、目录结构 | 组件级：跳过该 skill |
| mcp | schema、版本匹配、服务器条目、路径/占位符/URL | 组件级：跳过该服务器 |
| pathSafety | 路径逃逸、符号链接逃逸检查 | 按 §4.1 边界处理 |

### pack.js — 打包分发

将插件打包为 `.tgz` tarball。

```
node scripts/pack.js <plugin-root> [-o <output-dir>]
```

**输出**

```json
{"packed": true, "archive": "/abs/path/plugin-name-1.0.0.tgz", "bytes": 1024}
```

## Schema 数据接口

### schemas/plugin.schema.json

Agent Plugins 1.0.0 插件清单 JSON Schema，与官方 `plugin.schema.json` 保持一致，用于闭集字段校验。

### schemas/mcp.schema.json

Agent Plugins 1.0.0 MCP 配置 JSON Schema，暴露 `#/$defs/server` 供服务器条目独立校验。

## Skill 目录接口约定

AI 助手应遵循的交互约定：

| 组件 | 约定 |
|------|------|
| SKILL.md frontmatter | `name` 须与父目录同名，`description` 1-1024 字符 |
| skills/ 发现 | 仅扫描 skills/ 直接子目录中含 `SKILL.md` 的目录，不递归 |
| mcp.json 版本 | `$schema` 版本须与 plugin.json 一致 |
| 路径 | 插件相对路径以 `./` 开头，仅支持 `${PLUGIN_ROOT}`/`${PLUGIN_DATA}` 占位符 |
