# 开发指南

## 环境要求

- Node.js >= 18（脚本引擎运行环境）
- 无需 npm 安装任何运行时依赖（全部使用内置模块）
- 建议使用 [skills-ref](https://github.com/agentskills/agentskills/tree/main/skills-ref) 校验本 Skill 自身符合 Agent Skills 规范

## 快速开始

1. 克隆本仓库
2. 编写 / 修改 `SKILL.md` 与 `scripts/` 下脚本
3. 本地验证脚本功能：`node scripts/validate.js <示例插件目录>`
4. 安装到你的 AI 客户端：将本仓库目录（或副本）放入客户端的 skills 目录
5. 发布：将 skill 目录打包，按各平台 skill 安装流程分发

## 项目结构说明

```
SKILL.md                        # Skill 入口，frontmatter + 工作流指引
scripts/
  create.js                     # 脚手架生成引擎
  validate.js                   # 规范验证引擎
  pack.js                       # 打包引擎
  lib/
    schema.js                   # JSON Schema 子集校验器
    plugin-constraints.js       # 插件名/路径/占位符约束
    skill-frontmatter.js        # SKILL.md frontmatter 校验
    path-safety.js              # 路径逃逸安全
schemas/                        # 规范数据（plugin/mcp JSON Schema）
references/                     # 按需加载的规范要点文档
assets/templates/               # 脚手架模板
examples/hello-plugin/          # 示例插件（可作测试夹具）
```

## 开发规范

- **零运行时依赖**：scripts/ 下代码仅允许使用 Node.js 内置模块，禁止引入 npm 依赖。这是保证 Skill 在任何客户端可运行的硬性约束。
- **脚本独立可执行**：每个引擎脚本必须可通过 `node <script>` 直接运行并支持 `--help`。
- **结构化输出**：脚本以 JSON 输出结果，退出码 0 表示成功、非 0 表示失败，便于 AI 助手与 CI 解析。
- **校验规则与规范绑定**：所有校验逻辑必须以 [Agent Plugins 1.0.0 规范](https://agent-plugins.org/specification) 为准，规范变更时同步更新。
- **SKILL.md 精简**：主文件保持 < 500 行，详细规范拆入 references/。
- **测试驱动**：examples/ 下保留一个有效插件和一个无效插件作为测试夹具。

## 常见任务

| 任务 | 命令 |
|------|------|
| 测试脚手架 | `node scripts/create.js demo-plugin --full -d /tmp/demo` |
| 测试验证器 | `node scripts/validate.js examples/hello-plugin` |
| 测试打包 | `node scripts/pack.js examples/hello-plugin -o /tmp/dist` |
| 校验本 Skill | `skills-ref validate ./`（可选） |

## 构建与发布

- 本 Skill 无构建步骤（零依赖纯脚本）。
- 发布方式：将仓库打包为 zip/tgz，或直接推送到 git 仓库，按目标 AI 客户端的 skill 安装流程分发。
- 版本管理：遵循语义化版本，变更记录写入 CHANGELOG。
