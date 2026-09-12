# agentleak

**找出你已经泄露进 AI 聊天会话的秘钥——赶在别人之前。**

`agentleak` 自动发现本机所有 AI agent 的会话存储（Claude Code、Codex CLI、
Cursor、aider、Copilot CLI、网页聊天导出），扫描其中的 API key / SSH 私钥 /
token，并生成**轮换清单**；本地基线保证重复扫描只报告*新增*泄露。

**100% 离线**：无遥测、无网络请求、无账号。检测方式为正则 + 熵值——与
gitleaks 同一思路，但用在没人扫描的聊天记录上。

[English](README.md)

## 为什么需要

- 中转站转卖会话数据已有实锤：一个被粘进单次 ChatGPT 对话的 key，被追踪
  到扩散进 1,100+ 个公开数据集（Truffle Security 实测）。
- 各家 agent CLI 把完整对话明文永久写在本地磁盘：prompt、粘贴内容、工具输出。
- 现有秘钥扫描器只盯 git 仓库；企业 AI DLP 只盯网关流量。**没人盘点本地会话
  里已经躺着什么**——这就是本工具的全部职责。

## 安装

```bash
npm install -g agentleak
# 或一次性运行：
npx agentleak scan
```

要求 Node ≥ 20，支持 macOS / Linux / Windows。

## 快速上手

```bash
$ agentleak scan

agentleak v0.1.0 — scanned 412 files (81.3 MB) across 7 sources

5 finding(s) · 2 NEW · 1 critical, 3 high, 1 medium

  CRITICAL aws-access-key   AKIAIOSF…7EXAMPLE  NEW
    where:  2026-08-14 14:02 · Claude Code
            ~/.claude/projects/-home-dev-api/session-3f9c.jsonl:412
    rotate: AWS IAM → https://console.aws.amazon.com/iam/

Rotation checklist
  1. [critical] AWS IAM (1) → https://console.aws.amazon.com/iam/
  2. [high] Anthropic (2) → https://console.anthropic.com/settings/keys
  ...
```

轮换完一个凭据后：`agentleak mark <fingerprint> --rotated`。
误报：`agentleak mark <fingerprint> --false-positive`（之后默认隐藏，
`--all` 可查看全部）。

## 扫描范围

| 来源                             | 位置                                                     | 模式     |
| -------------------------------- | -------------------------------------------------------- | -------- |
| Claude Code                      | `~/.claude/projects/**`、`history.jsonl`、`paste-cache/` | 精确解析 |
| Codex CLI                        | `~/.codex/sessions/**`、`history.jsonl`                  | 精确解析 |
| ChatGPT 导出                     | `--export export.zip` → `conversations.json`             | 精确解析 |
| claude.ai 导出                   | `--export export.json`                                   | 精确解析 |
| Cursor                           | `state.vscdb`（SQLite）                                  | 尽力而为 |
| aider                            | 项目内 `.aider.chat.history.md`                          | 尽力而为 |
| Copilot CLI                      | `~/.copilot/session-state/**`                            | 尽力而为 |
| 项目文件                         | `.env*`、`.mcp.json`（会被读进上下文）                   | 精确解析 |
| Claude 配置                      | `~/.claude.json`、`settings.json`（MCP key）             | 精确解析 |
| Windsurf / Continue / Gemini CLI | 已探测，解析器在路上                                     | 仅提示   |

`~/.codex/auth.json` 这类“key 本该存在的地方”**不会**被当作泄露上报。

## 命令

```
agentleak scan [--reveal] [--json] [--export <path>] [--path <dir>]
               [--rules <file>] [--no-baseline] [--all] [--exit-zero]
agentleak mark <fingerprint> --rotated|--false-positive|--open
agentleak list [--json]
agentleak guard [--rules <file>]   # 读 stdin，发现秘钥则 exit 2
```

有发现时 `scan` 返回退出码 `1`（方便接 cron/CI），`--exit-zero` 可关闭。
输出**默认脱敏**——截图安全；`--reveal` 显示完整值。

## Agent 集成

见 [integrations/](integrations/README.md)：

- **Claude Code 插件**（插件市场）：skill + `UserPromptSubmit` hook，在
  prompt 发送前拦截含秘钥的内容。
- **Cursor 规则**、**Codex CLI hook**、**Gemini CLI** 片段。
- 通用 `SKILL.md`，适配任何加载 skill 的 agent 运行时。

## 安全承诺

1. **永不联网**。零网络请求：无遥测、无更新检查、无“验证 API”。
2. **不引入第三方规则**。规则为本仓库手写（MIT），不搬 AGPL 检测器。
3. **默认脱敏**。完整秘钥仅在显式 `--reveal` 时出现。
4. 若未来增加联网验证，一定是可选项、本地执行、直连 provider、默认关闭。

发现 agentleak 本身的安全问题请看 [SECURITY.md](SECURITY.md)。

## 诚实的局限

- 检测是启发式的（正则 + 香农熵）。会有误报——标记即可；也可能偶有漏报
  ——任何进过聊天窗口的 key 都建议轮换。
- Cursor 支持读取 SQLite 原始 dump，只能定位到文件级。
- 加密存储、企业网关日志、云端托管会话不在范围内——本工具只做本地取证。

## 路线图

- [ ] Windsurf / Continue / Gemini CLI 解析器
- [ ] 剪贴板 watcher（可选开启），往网页聊天粘贴秘钥前提醒
- [ ] 从 gitleaks 格式 TOML 导入规则包
- 明确不做：浏览器扩展、云同步、默认联网验证

## 致谢

- [DidILeak](https://github.com/frangelbarrera/DidILeak)——最接近的先行
  工具；agentleak 增加了自动发现、本地基线与 agent 集成。
- [gitleaks](https://github.com/gitleaks/gitleaks)——规则文件格式兼容（MIT）。
- [Truffle Security](https://trufflesecurity.com/blog/scanning-7-6-petabytes-of-ai-training-data-for-secrets)
  ——量化 AI 聊天秘钥泄露的研究。

## 许可证

[MIT](LICENSE)
