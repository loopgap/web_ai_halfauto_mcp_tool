# Security Model

## Overview

AI Workbench is a **desktop automation application** that runs locally on the user's machine. It is not a web service, API server, or networked application. Understanding this is fundamental to evaluating its security model.

## Desktop App vs Web App Security

| Concern | Web App | AI Workbench (Desktop) |
|---------|---------|------------------------|
| Untrusted clients | Yes - browsers, mobile apps | No - local UI bundled with backend |
| Network attack surface | Yes - HTTP APIs exposed | No - no network listeners |
| Authentication | Critical - must verify identity | Not applicable - runs as local user |
| CSRF attacks | Possible | Not possible - no cookie/session auth |
| Command injection | Possible via injected input | Inputs validated before dispatch |

## Why No Auth on Tauri Commands

Adding authentication to Tauri commands would provide **no meaningful security benefit** because:

1. **Same trust boundary**: The frontend UI and backend commands are bundled in the same desktop application. A "malicious frontend" would be the user's own local process.

2. **Local-only operation**: The app doesn't expose any network APIs. All operations happen in the context of the logged-in desktop session.

3. **Runs as local user**: The app has the same permissions as the user who launched it. There's no privilege separation between "authentication layer" and "command execution."

4. **Attack requires code execution**: If an attacker can call Tauri commands directly (bypassing auth), they already have code execution on the user's machine - the damage is done.

## What's Actually Protected

### Input Validation

- **Rate limiting**: Dispatch commands are rate-limited to prevent abuse
- **Payload size limits**: Text dispatch limited to 120KB, regex patterns to 512 chars
- **Regex complexity limits**: Max 32 patterns, max 512 chars each
- **Null byte rejection**: Prevents clipboard injection attacks
- **State transition validation**: Run state machine enforces valid transitions only

### Audit & Forensics

- All security-relevant events written to `vault/audit/security_events.jsonl`
- Dispatch operations logged with trace IDs for correlation
- Vault stores immutable run records for post-incident analysis

### Clipboard Safety

- Clipboard transactions restore original clipboard state on failure
- Prevents clipboard data leakage between operations

### Prompt Injection Detection

The app detects common prompt injection patterns in user prompts:
- `ignore previous instructions`
- `forget previous commands`
- `you are now a [different AI]`
- System prompt override patterns (`[INST]`, `<<SYS>>`)
- DAN/Jailbreak attempts

## User Best Practices

1. **Keep the app updated**: Security fixes are shipped in new versions
2. **Review target configs**: Only add trusted automation targets
3. **Protect vault files**: The `vault/` directory contains sensitive run data - back it up securely
4. **No remote execution**: The app doesn't support remote operation - don't try to expose it as a service
5. **Local-only workflow**: This tool is designed for local desktop automation; running it on shared or untrusted systems is out of scope

## Data Storage

All data is stored locally in:
- **Windows**: `%APPDATA%\ai-workbench\`
- **Linux**: `~/.config/ai-workbench/`
- **macOS**: `~/Library/Application Support/ai-workbench/`

No telemetry or data is transmitted to external servers unless explicitly configured by the user (e.g., LLM provider API calls).

## Reporting Security Issues

For security concerns specific to this codebase, please open a GitHub issue. For vulnerabilities in dependencies, follow standard disclosure practices.
