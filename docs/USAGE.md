# mcpick — Usage Guide

> Pick and sync MCP server configs across AI tools.

## Install

```bash
# macOS (Homebrew)
brew install lucid-jin/tap/mcpick

# Windows (Scoop)
scoop bucket add mcpick https://github.com/lucid-jin/scoop-mcpick
scoop install mcpick

# Go install
go install github.com/lucid-jin/mcpick@latest

# Binary download
# https://github.com/lucid-jin/mcpick/releases
```

---

## Commands

### `mcpick list`

내 PC에 설치된 모든 AI 도구의 MCP 서버 현황을 조회합니다.

```bash
# 기본 (테이블 출력)
mcpick list

# 출력 예시:
# ┌─────────────────┬──────────────────┬────────┬────────┐
# │ Tool            │ Server           │ Type   │ Status │
# ├─────────────────┼──────────────────┼────────┼────────┤
# │ Claude Code     │ chrome-devtools  │ stdio  │ ✓      │
# │                 │ linear-server    │ http   │ ✓      │
# │                 │ sentry           │ http   │ ✓      │
# │                 │ vercel           │ stdio  │ ✓      │
# │                 │ zep-admin        │ stdio  │ ✓      │
# ├─────────────────┼──────────────────┼────────┼────────┤
# │ Claude Desktop  │ chrome-devtools  │ stdio  │ ✓      │
# │                 │ mcp-clickhouse   │ stdio  │ ✓      │
# │                 │ posthog          │ stdio  │ ✓      │
# ├─────────────────┼──────────────────┼────────┼────────┤
# │ Cursor          │ zep-quiz Docs    │ stdio  │ ✓      │
# │                 │ zep Docs         │ stdio  │ ✓      │
# └─────────────────┴──────────────────┴────────┴────────┘
#
# 3 tools detected, 10 servers total

# JSON 출력
mcpick list --json

# 상세 출력 (env, args 포함)
mcpick list --verbose
mcpick list -v
```

---

### `mcpick sync`

MCP 서버 설정을 도구 간 싱크합니다. 인터랙티브 / 다이렉트 두 가지 모드를 지원합니다.

#### Interactive Mode (TUI)

```bash
mcpick sync
```

```
┌──────────────────────────────────────────────────────┐
│                    mcpick sync                       │
│                                                      │
│  Step 1/3 — Source                                   │
│                                                      │
│  어디서 가져올까요?                                      │
│                                                      │
│  > ● Claude Code          (5 servers)                │
│    ○ Claude Desktop       (10 servers)               │
│    ○ Cursor               (2 servers)                │
│                                                      │
│  ↑/↓ Navigate  Enter Select  q Quit                  │
└──────────────────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────────────────┐
│                    mcpick sync                       │
│                                                      │
│  Step 2/3 — Pick servers                             │
│                                                      │
│  어떤 서버를 싱크할까요?                                  │
│                                                      │
│  [x] chrome-devtools      stdio                      │
│  [x] linear-server        http   ⚠ will convert     │
│  [ ] sentry               http   ⚠ will convert     │
│  [x] vercel               stdio                      │
│  [ ] zep-admin            stdio                      │
│                                                      │
│  ↑/↓ Navigate  Space Toggle  a All  Enter Confirm    │
└──────────────────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────────────────┐
│                    mcpick sync                       │
│                                                      │
│  Step 3/3 — Target                                   │
│                                                      │
│  어디로 넣을까요?                                       │
│                                                      │
│  > ● Claude Desktop       (HTTP → mcp-remote 자동변환) │
│    ○ Cursor               (HTTP 그대로 유지)            │
│    ○ Codex                (TOML 변환)                  │
│    ○ Gemini CLI                                      │
│    ○ Copilot CLI                                     │
│                                                      │
│  ↑/↓ Navigate  Enter Select  q Quit                  │
└──────────────────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────────────────┐
│                    mcpick sync                       │
│                                                      │
│  Preview                                             │
│                                                      │
│  Claude Code → Claude Desktop                        │
│                                                      │
│  + chrome-devtools    stdio  (그대로)                  │
│  ~ linear-server      http → mcp-remote (변환)        │
│  + vercel             stdio  (그대로)                  │
│                                                      │
│  ⚠ chrome-devtools already exists → overwrite         │
│                                                      │
│  Apply? (y/n)  b Back  q Quit                        │
└──────────────────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────────────────┐
│                    mcpick sync                       │
│                                                      │
│  ✓ Done!                                             │
│                                                      │
│  Synced 3 servers: Claude Code → Claude Desktop      │
│  Backup saved: ~/.mcpick/backup/1712045127/          │
│                                                      │
│  Press any key to exit                               │
└──────────────────────────────────────────────────────┘
```

#### Direct Mode (CLI)

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

#### Tool ID Reference

| ID | Tool |
|---|---|
| `claude-code` | Claude Code (settings.json mcpServers) |
| `claude-mcp` | Claude Code (~/.claude/.mcp.json) |
| `claude-desktop` | Claude Desktop |
| `cursor` | Cursor |
| `codex` | Codex |
| `gemini` | Gemini CLI |
| `copilot` | GitHub Copilot CLI |

---

### `mcpick doctor`

MCP 설정의 문제점을 검증하고 수정을 제안합니다.

```bash
# 검증만
mcpick doctor

# 출력 예시:
# Scanning 3 tools...
#
# ⚠ Claude Desktop
#   └─ linear-server: uses HTTP type (not supported)
#      → Fix: wrap with npx mcp-remote
#   └─ sentry: uses HTTP type (not supported)
#      → Fix: wrap with npx mcp-remote
#
# ⚠ Claude Desktop
#   └─ google-sheets: relative path in GOOGLE_APPLICATION_CREDENTIALS
#      → Fix: resolve to /Users/zep/WebstormProjects/zep-client/_scripts/...
#
# ✓ chrome-devtools: OK (found in 2 tools)
# ✓ mcp-clickhouse: OK
#
# Summary: 10 servers across 3 tools — 3 issues found

# 자동 수정 적용
mcpick doctor --fix

# 특정 도구만 검증
mcpick doctor claude-desktop
```

---

## Global Flags

```bash
--json          # JSON 형식으로 출력
--verbose, -v   # 상세 출력
--no-color      # 컬러 비활성화
--config        # 커스텀 설정 파일 경로
--version       # 버전 출력
--help, -h      # 도움말
```

---

## Config File (Optional)

`~/.mcpick/config.yaml` 로 기본 동작을 커스터마이즈할 수 있습니다.

```yaml
# 기본 소스 도구
defaultSource: claude-code

# 싱크 시 자동 백업
backup: true

# 충돌 처리 기본값: overwrite | skip | ask
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

## Examples

```bash
# 내 PC MCP 현황 한눈에 보기
mcpick list

# Claude Code 서버를 Claude Desktop으로 싱크 (HTTP 자동 변환)
mcpick sync claude-code claude-desktop

# Cursor에 clickhouse만 추가
mcpick sync claude-code cursor --pick mcp-clickhouse

# Claude Desktop에서 Claude Code로 역방향 싱크
mcpick sync claude-desktop claude-code

# 모든 설정 검증 후 자동 수정
mcpick doctor --fix
```
