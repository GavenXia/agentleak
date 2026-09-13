<div align="center">

# agentleak

**找出你已经泄露进 AI 聊天会话的秘钥——赶在别人之前。**

[![CI](https://github.com/GavenXia/agentleak/actions/workflows/ci.yml/badge.svg)](https://github.com/GavenXia/agentleak/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/agentleak)](https://www.npmjs.com/package/agentleak)
[![license](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![node](https://img.shields.io/badge/node-%E2%89%A520-339933)](package.json)
[![offline](https://img.shields.io/badge/network-0%20calls-2ea44f)](SECURITY.md)

一个离线、本地优先的 CLI：自动发现**本机所有 AI agent 的会话存储**，扫描其中
的 API key / SSH 私钥 / token，生成**轮换清单**——配合本地基线，重复扫描只报告
*新增*泄露。

[一键开始](#-一键开始) · [工作原理](#%EF%B8%8F-工作原理) · [各 Agent 接入](#-各-agent-接入方式) · [安全承诺](#%EF%B8%8F-安全承诺)

[English](README.md)

</div>

---

## 🚨 解决什么问题

**你的 AI agent 聊天记录，是一块你从未审计过的凭据泄漏面。**

每次你（或同事）把 API key 粘贴进聊天——"拿这个 token 去部署"——这个秘钥就被
**明文**写进了磁盘，无加密，且往往永久保留：

```text
~/.claude/projects/**/session-*.jsonl    # Claude Code 完整对话记录
~/.codex/sessions/**/*.jsonl             # Codex CLI 完整对话记录
~/Library/Application Support/Cursor/    # Cursor 聊天正文（SQLite）
~/.claude/paste-cache/*.txt              # 原始粘贴内容缓存
```

而单次粘贴的影响面还在持续扩大：

| 事实                                                                                                                                                          | 来源                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 一个被粘进**单次 ChatGPT 对话**的 Infura key，经 WildChat 采集后扩散到 **1,131 个公开数据集**                                                                 | [Truffle Security：扫描 7.6 PB AI 训练数据](https://trufflesecurity.com/blog/scanning-7-6-petabytes-of-ai-training-data-for-secrets) |
| 6,003 个公开 AI 数据集中发现 221,303 个**仍有效**的凭据                                                                                                       | 同上                                                                                                                                 |
| 安全研究员购买 **6TB 中转站调用日志**，内含 SSH 私钥、VPN 配置、阿里云 key、GitLab token——声称足以触及 19 家头部企业（华为、小米、蔚来等）与 7 家政府相关机构 | [Chaofan Shou (Fuzzland)，2026-09](https://x.com/shoucccc/status/2098169782541631871)（研究声称）                                    |
| 中国官方媒体与国家安全部公开警告：API 中转站泄漏并转卖用户对话                                                                                                | [新华社 / 国安部提示，2026](https://app.xinhuanet.com/news/article.html?articleId=20260608081c2c78593d4394b46b0cf31bec0a4f)          |
| 对 400+ 中转站的学术实测：45% 偷换假模型、**17% 窃取测试凭据**、9 个注入恶意代码                                                                              | [中转站风险研究](https://getgptplus.app/blog/api-relay-risks)                                                                        |
| 被盗 AI key 在黑产以 97.8% 折扣转卖（$3,333 额度卖 $0.13）                                                                                                    | [CSA 影子中转市场研究](https://labs.cloudsecurityalliance.org/research/csa-research-note-llm-api-relay-market-shadow-risk-20260729/) |
| 公开暴露的 AI 凭据**几分钟内**即被利用                                                                                                                        | Lasso Security                                                                                                                       |
| agent 厂商至今没有内置对已存对话的秘钥脱敏                                                                                                                    | [claude-code#29434](https://github.com/anthropics/claude-code/issues/29434)（仍为 open）                                             |

现有工具都不覆盖这个面：秘钥扫描器（gitleaks 等）只扫 git 仓库；企业 AI DLP
只看网关流量。**没人盘点本地会话里已经躺着什么。** 这就是 agentleak 的全部职责。

## 🛠️ 工作原理

```text
 ┌──────────┐   ┌────────────┐   ┌──────────────┐   ┌──────────┐   ┌───────────────┐
 │  发现    │ → │   解析     │ → │    检测      │ → │   基线   │ → │     报告      │
 │ 遍历所有 │   │ 按格式     │   │ 20 条规则：  │   │ SHA-256  │   │ 脱敏展示      │
 │ agent    │   │ 解析成     │   │ 正则 +       │   │ 指纹 →   │   │ + 轮换清单    │
 │ 会话存储 │   │ 文本块     │   │ 香农熵       │   │ 只报新增 │   │ + --json      │
 └──────────┘   └────────────┘   └──────────────┘   └──────────┘   └───────────────┘
                        全程离线、单进程、数秒完成
```

- **发现**：内置各 agent 会话存储路径（区分操作系统），无需手动指定文件。
- **解析**：理解真实格式（Claude JSONL、Codex 封包、Cursor SQLite、ChatGPT
  导出树……），因此定位到*泄露秘钥的那条消息*，而不只是文件。
- **检测**：gitleaks 兼容的 TOML 规则（正则 + 熵值门控），每条规则带严重级别
  和 provider **轮换链接**。以精确率优先控制误报；标记过 `--false-positive`
  的条目从此不再出现。
- **基线**：在 `~/.agentleak/baseline.json` 存截断的 SHA-256 指纹（**不存秘钥
  本身**），重复扫描只打印变化部分。
- **报告**：所有值脱敏（`sk-ant-a…9f2Q`），输出可安全贴进 issue、聊天和截图；
  需要完整值时用 `--reveal`。

> 为什么不直接用 gitleaks 扫主目录？可以——前提是你自己枚举正确路径、解析各
> 种格式、跨次扫描去重、手工查每家 provider 的轮换入口。agentleak 就是把这套
> 流程一次性做对。

## ⚡ 一键开始

零配置、一条命令、无需永久安装：

```bash
npx agentleak scan
```

真实首次运行输出（值默认脱敏）：

```text
agentleak v0.1.0 — scanned 477 files (1745.7 MB) across 8 sources
credential stores (expected locations, not reported): ~/.codex/auth.json

93 finding(s) · 31 NEW · 6 high, 1 medium, 86 low

  HIGH     github-token  ghp_1fPh…xghU NEW
    where:  2026-08-25 09:22 · Claude Code
            ~/.claude/projects/…/fbe5b217-….jsonl:198
    rotate: GitHub → https://github.com/settings/tokens

Rotation checklist
  1. [high] GitHub (2) → https://github.com/settings/tokens
  ...
```

然后按清单处理：

```bash
agentleak mark <fingerprint> --rotated          # 轮换完凭据后标记
agentleak mark <fingerprint> --false-positive   # 静音误报
agentleak list                                  # 查看已知条目
```

有发现时 `scan` 返回退出码 `1`（方便接 cron/CI，`--exit-zero` 可关闭）。要扫描
网页聊天历史：`agentleak scan --export ~/Downloads/chatgpt-export.zip`。

## 📦 扫描范围

| 来源                             | 位置                                                     | 模式           |
| -------------------------------- | -------------------------------------------------------- | -------------- |
| Claude Code                      | `~/.claude/projects/**`、`history.jsonl`、`paste-cache/` | 精确（消息级） |
| Codex CLI                        | `~/.codex/sessions/**`、`history.jsonl`                  | 精确           |
| ChatGPT 导出                     | `--export export.zip` → `conversations.json`             | 精确           |
| claude.ai 导出                   | `--export export.json`                                   | 精确           |
| Cursor                           | `state.vscdb` SQLite（只读副本）                         | 尽力而为       |
| aider                            | 项目内 `.aider.chat.history.md`                          | 尽力而为       |
| Copilot CLI                      | `~/.copilot/session-state/**`                            | 尽力而为       |
| 项目文件                         | `.env*`、`.mcp.json`（会被读进上下文）                   | 精确           |
| Claude 配置                      | `~/.claude.json`、`settings.json`（MCP key）             | 精确           |
| Windsurf / Continue / Gemini CLI | 探测到即提示"暂不支持"                                   | 仅提示         |

`~/.codex/auth.json` 这类"key 本该存在的地方"**永远不会**被当作泄露上报。

## 🤖 各 Agent 接入方式

所有集成共用同一个离线二进制，先装一次：

```bash
npm install -g agentleak
```

### Claude Code

```bash
# 从插件市场安装（skill + UserPromptSubmit 拦截 hook）
claude plugin marketplace add GavenXia/agentleak
claude plugin install agentleak@agentleak
```

或手动在 `~/.claude/settings.json` 配置 guard hook——每条 prompt *发送前*检查，
含秘钥则阻断（exit 2）：

```json
{
  "hooks": {
    "UserPromptSubmit": [{ "hooks": [{ "type": "command", "command": "agentleak guard" }] }]
  }
}
```

### Cursor

```bash
cp integrations/cursor/rules/agentleak.mdc  <你的项目>/.cursor/rules/
```

该规则让 agent 永不向你索要秘钥，并支持按需运行审计。（Cursor 暂无官方
prompt hook，规则为 advisory。）

### Codex CLI

```bash
# 提示词约束
cat integrations/codex/AGENTS.md >> ~/.codex/AGENTS.md

# 发送前阻断（Codex CLI ≥ v0.117）：~/.codex/hooks.json
# { "UserPromptSubmit": [{ "command": "agentleak guard" }] }
```

### Gemini CLI

```bash
cat integrations/gemini/GEMINI.md >> ~/.gemini/GEMINI.md
```

### 其他任意 Agent

- 通用 skill：把 `integrations/agents/skill/` 拷进你的 skills 目录。
- 任何"发送前能执行命令"的工具：

```bash
echo "<prompt>" | agentleak guard   # exit 0 = 干净 · exit 2 = 含秘钥
```

## 📖 命令参考

```
agentleak scan [--reveal] [--json] [--export <path>] [--path <dir>]
               [--rules <file>] [--no-baseline] [--all] [--exit-zero]
agentleak mark <fingerprint> --rotated|--false-positive|--open
agentleak list [--json]
agentleak guard [--rules <file>]
```

| 退出码 | 含义                           |
| ------ | ------------------------------ |
| `0`    | 干净（guard：prompt 不含秘钥） |
| `1`    | scan 有发现                    |
| `2`    | 出错 · guard：prompt 含秘钥    |

自定义规则：任意 gitleaks 风格 TOML，外加我们的 `severity` 和
`[rules.provider]` 轮换扩展——见 [rules/default.toml](rules/default.toml)。

## 🛡️ 安全承诺

秘钥扫描工具只有让你敢把秘钥交给它才有意义。四条不可妥协的承诺（代码评审
强制执行，细则见 [SECURITY.md](SECURITY.md)）：

1. **永不联网**。零网络调用——无遥测、无更新检查、无"验证 API"。`dist/` 里
   没有任何代码能发出请求。
2. **不引入第三方规则集**。规则为本仓库手写（MIT），不搬 AGPL 检测器合集。
3. **默认脱敏**。完整秘钥仅在显式 `--reveal` 时出现；基线存 SHA-256 指纹，
   永不存值。
4. **读写范围明确**。只读 agent 会话/配置存储与工作目录下的 `.env` 类文件；
   只写一个文件（`~/.agentleak/baseline.json`）。

发现 agentleak 本身的安全问题请走私密漏洞报告渠道——**切勿**把真实秘钥贴进
issue。

## ⚠️ 诚实的局限

- 检测是启发式的（正则 + 熵值）：偶有误报（标记即可），也可能漏报（任何进过
  聊天窗口的 key 都建议轮换）。
- Cursor 只能定位到文件级（原始 SQLite dump 方式）。
- 加密存储、企业网关日志、云端托管会话不在范围内——本工具只做本地取证。

## 🗺️ 路线图

- [ ] Windsurf / Continue / Gemini CLI 解析器
- [ ] 可选开启的剪贴板 watcher：往网页聊天粘贴秘钥前提醒
- [ ] 从任意 gitleaks 格式 TOML 导入规则包
- **明确不做**：浏览器扩展、云同步、默认联网验证

## 🙏 致谢

- [DidILeak](https://github.com/frangelbarrera/DidILeak)——最接近的先行工具；
  agentleak 增加了自动发现、本地基线与 agent 集成。
- [gitleaks](https://github.com/gitleaks/gitleaks)——规则格式兼容（MIT）。
- [Truffle Security](https://trufflesecurity.com/blog/scanning-7-6-petabytes-of-ai-training-data-for-secrets)——
  量化 AI 聊天秘钥泄露的研究。

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=GavenXia/agentleak&type=Date)](https://star-history.com/#GavenXia/agentleak&Date)

## 许可证

[MIT](LICENSE)
