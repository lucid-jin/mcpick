# mcpick — Usage Guide

> Pick and sync MCP server configs across AI tools.

## Project Overview

| 항목 | 내용 |
|------|------|
| **Repo** | [github.com/lucid-jin/mcpick](https://github.com/lucid-jin/mcpick) |
| **Stack** | Bun / TypeScript |
| **Runtime** | Bun (npx/bunx 호환) |
| **License** | MIT |

## Install

```bash
# npm (npx로 바로 실행)
npx mcpick list

# bunx
bunx mcpick list

# 글로벌 설치
npm install -g mcpick
# 또는
bun add -g mcpick
```

---

## Supported Tools

| ID | Tool | Config Path | Format | HTTP Support |
|---|---|---|---|---|
| `claude-code` | Claude Code | `~/.claude/settings.json` | JSON | O |
| `claude-mcp` | Claude Code (.mcp) | `~/.claude/.mcp.json` | JSON | O |
| `claude-desktop` | Claude Desktop | `~/Library/Application Support/Claude/claude_desktop_config.json` | JSON | **X** (mcp-remote 변환) |
| `cursor` | Cursor | `~/.cursor/mcp.json` | JSON | O |
| `codex` | Codex | `~/.codex/config.toml` | TOML | X (변환 필요) |
| `gemini` | Gemini CLI | `~/.gemini/settings.json` | JSON | O |
| `copilot` | Copilot CLI | `~/.copilot/mcp-config.json` | JSON | O |

> Windows/Linux 경로는 자동 분기됩니다.

---

## Commands

### `mcpick list`

내 PC에 설치된 모든 AI 도구의 MCP 서버 현황을 조회합니다.

**Status: DONE**

```bash
mcpick list
```

```
Claude Code (~/.claude/settings.json)
  chrome-devtools           stdio
  linear-server             http
  sentry                    http
  vercel                    stdio
  zep-admin                 stdio

Claude Code (.mcp.json) (~/.claude/.mcp.json)
  slack-agent               stdio

Claude Desktop (~/Library/Application Support/Claude/claude_desktop_config.json)
  chrome-devtools           stdio
  linear-server             stdio
  sentry                    stdio
  vercel                    stdio
  zep-admin                 stdio
  slack-agent               stdio
  mcp-clickhouse            stdio
  posthog                   stdio
  google-sheets             stdio
  context7                  stdio

Cursor (~/.cursor/mcp.json)
  zep-quiz-client Docs      http
  zep Docs                  http

6 tools detected, 22 servers total
```

#### Flags

```bash
mcpick list --json       # JSON 출력
mcpick list --verbose    # command, args, env 상세 출력
mcpick list -v           # --verbose 단축
```

---

### `mcpick sync`

MCP 서버 설정을 도구 간 싱크합니다. 인터랙티브 / 다이렉트 두 가지 모드를 지원합니다.

**Status: TODO**

#### Interactive Mode

```bash
mcpick sync
```

**Step 1 — Source 선택**
```
? 어디서 가져올까요?
> Claude Code          (5 servers)
  Claude Desktop       (10 servers)
  Cursor               (2 servers)
  Gemini CLI           (4 servers)
```

**Step 2 — Server 선택** (체크박스)
```
? 어떤 서버를 싱크할까요? (Space로 토글, a로 전체 선택)
  [x] chrome-devtools      stdio
  [x] linear-server        http   ⚠ will convert
  [ ] sentry               http   ⚠ will convert
  [x] vercel               stdio
  [ ] zep-admin            stdio
```

**Step 3 — Target 선택**
```
? 어디로 넣을까요?
> Claude Desktop       (HTTP → mcp-remote 자동변환)
  Cursor               (HTTP 그대로 유지)
  Codex                (TOML 변환)
  Gemini CLI
  Copilot CLI
```

**Step 4 — Preview & Confirm**
```
Claude Code → Claude Desktop

  + chrome-devtools    stdio  (그대로)
  ~ linear-server      http → mcp-remote (변환)
  + vercel             stdio  (그대로)

  ⚠ chrome-devtools already exists → overwrite

? Apply? (Y/n)
```

**완료**
```
✓ Synced 3 servers: Claude Code → Claude Desktop
  Backup saved: ~/.mcpick/backup/20260402-143527/
```

#### Direct Mode

```bash
# 전체 싱크
mcpick sync claude-code claude-desktop

# 특정 서버만 골라서 싱크
mcpick sync claude-code claude-desktop --pick sentry,clickhouse

# 전체 서버 싱크
mcpick sync claude-code cursor --all

# 프리뷰만 (실제 적용 안 함)
mcpick sync claude-code claude-desktop --dry-run

# 충돌 시 자동 덮어쓰기
mcpick sync claude-code cursor --force
```

#### Flags

```bash
--pick <servers>   # 특정 서버만 (콤마 구분)
--all              # 전체 서버
--dry-run          # 프리뷰만
--force            # 충돌 시 자동 덮어쓰기
```

---

### `mcpick doctor`

MCP 설정의 문제점을 검증하고 수정을 제안합니다.

**Status: TODO**

```bash
mcpick doctor
```

```
Scanning 6 tools...

⚠ Claude Desktop
  └─ linear-server: uses HTTP type (not supported in config file)
     → Fix: wrap with npx mcp-remote https://mcp.linear.app/mcp
  └─ sentry: uses HTTP type (not supported in config file)
     → Fix: wrap with npx mcp-remote https://mcp.sentry.dev/mcp

⚠ google-sheets
  └─ GOOGLE_APPLICATION_CREDENTIALS uses relative path
     → Fix: resolve to /Users/zep/WebstormProjects/zep-client/_scripts/translation/service-account.json

✓ 22 servers across 6 tools — 3 issues found
```

#### Flags

```bash
mcpick doctor              # 전체 검증
mcpick doctor claude-desktop   # 특정 도구만
mcpick doctor --fix        # 자동 수정 적용
```

#### 검증 항목

| 검증 | 설명 |
|------|------|
| HTTP on unsupported | HTTP 미지원 도구에 HTTP 서버 설정 감지 |
| Relative paths | env 값에 상대경로 사용 감지 |
| Missing files | 참조하는 파일 경로가 존재하지 않음 |
| Duplicate servers | 동일 서버가 여러 도구에 중복 존재 (info) |

---

## Transform Rules (핵심 로직)

싱크 시 자동으로 적용되는 변환 규칙:

### 1. HTTP → mcp-remote (Claude Desktop, Codex용)

```
# Before (source: Claude Code)
"linear-server": {
  "type": "http",
  "url": "https://mcp.linear.app/mcp"
}

# After (target: Claude Desktop)
"linear-server": {
  "command": "npx",
  "args": ["-y", "mcp-remote", "https://mcp.linear.app/mcp"]
}
```

### 2. mcp-remote → HTTP (역방향)

```
# Before (source: Claude Desktop)
"linear-server": {
  "command": "npx",
  "args": ["-y", "mcp-remote", "https://mcp.linear.app/mcp"]
}

# After (target: Cursor)
"linear-server": {
  "type": "http",
  "url": "https://mcp.linear.app/mcp"
}
```

### 3. 상대경로 → 절대경로

```
# Before (project .mcp.json)
"env": {
  "GOOGLE_APPLICATION_CREDENTIALS": "_scripts/translation/service-account.json"
}

# After
"env": {
  "GOOGLE_APPLICATION_CREDENTIALS": "/Users/zep/WebstormProjects/zep-client/_scripts/translation/service-account.json"
}
```

### 4. Non-MCP 필드 보존

싱크 시 `preferences`, `settings` 등 기존 설정의 non-MCP 필드는 건드리지 않습니다.

---

## Config File (Optional)

`~/.mcpick/config.yaml`

```yaml
# 기본 소스 도구
defaultSource: claude-code

# 싱크 시 자동 백업
backup: true

# 충돌 처리: overwrite | skip | ask
onConflict: ask

# 무시할 서버 (싱크 대상에서 제외)
ignore:
  - zep-admin

# 커스텀 도구 경로 오버라이드
tools:
  claude-desktop:
    path: ~/Library/Application Support/Claude/claude_desktop_config.json
```

---

## Roadmap

| Step | 기능 | 상태 |
|------|------|------|
| 0 | 프로젝트 초기 세팅 | ✅ Done |
| 1 | Tool Registry (7개 도구, OS별 경로) | ✅ Done |
| 2 | Config Parser (JSON 파싱, TOML 추후) | ✅ Done |
| 3 | Transform Adapter (HTTP↔mcp-remote, 경로 변환) | ⬜ TODO |
| 4 | `list` 커맨드 | ✅ Done |
| 5 | `sync` 커맨드 (인터랙티브 + 다이렉트) | ⬜ TODO |
| 6 | `doctor` 커맨드 (검증 + --fix) | ⬜ TODO |
| 7 | 배포 (npm publish) | ⬜ TODO |
| v2 | 웹 대시보드 (Bun.serve + React) | ⬜ Future |

---

## Quick Examples

```bash
# 내 PC MCP 현황 한눈에 보기
mcpick list

# Claude Code → Claude Desktop 싱크 (HTTP 자동 변환)
mcpick sync claude-code claude-desktop

# Cursor에 clickhouse만 추가
mcpick sync claude-code cursor --pick mcp-clickhouse

# Claude Desktop → Claude Code 역방향 싱크
mcpick sync claude-desktop claude-code

# 모든 설정 검증 후 자동 수정
mcpick doctor --fix

# 프리뷰만 보기
mcpick sync claude-code claude-desktop --dry-run
```
