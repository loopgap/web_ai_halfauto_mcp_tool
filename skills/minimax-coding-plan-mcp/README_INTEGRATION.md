# MiniMax Coding Plan MCP Integration

## Overview

This integration provides access to MiniMax's AI-powered search and vision analysis tools via the Model Context Protocol (MCP).

## Available Tools

### web_search
Performs web searches and returns organic search results with related search queries.

### understand_image
Analyzes images with AI based on text prompts, extracts information and answers questions about images. Supports JPEG, PNG, and WebP formats.

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `MINIMAX_API_KEY` | Your MiniMax API key | Yes |
| `MINIMAX_API_HOST` | API endpoint URL | Yes |

### Region-Specific Configuration

| Region | API Key Source | API Host |
|--------|----------------|----------|
| Global | [MiniMax Global](https://www.minimax.io/platform/user-center/basic-information/interface-key) | `https://api.minimax.io` |
| Mainland China | [MiniMax CN](https://platform.minimaxi.com/user-center/basic-information/interface-key) | `https://api.minimaxi.com` |

**Important:** API key and host must be from the same region, otherwise you will get an "Invalid API key" error.

## MCP Server Configuration

### Claude Desktop

Edit `claude_desktop_config.json` (located at `Claude > Settings > Developer > Edit Config`):

```json
{
  "mcpServers": {
    "MiniMax": {
      "command": "uvx",
      "args": [
        "minimax-coding-plan-mcp",
        "-y"
      ],
      "env": {
        "MINIMAX_API_KEY": "your-api-key-here",
        "MINIMAX_API_HOST": "https://api.minimax.io"
      }
    }
  }
}
```

### Cursor

Go to `Cursor -> Preferences -> Cursor Settings -> MCP -> Add new global MCP Server` and add the same configuration.

### Windows Note

If using Windows, enable "Developer Mode" in Claude Desktop to use MCP servers. Click "Help" in the hamburger menu and select "Enable Developer Mode".

## Usage Examples

### Web Search

```python
# Example: Search for Python async tutorials
web_search(query="Python async await tutorial", num_results=5)
```

Returns structured results including titles, links, snippets, and related searches.

### Image Analysis

```python
# Example: Analyze an image from URL
understand_image(
    image="https://example.com/screenshot.png",
    prompt="What does this code do? Explain the algorithm."
)

# Example: Analyze a local image
understand_image(
    image="/path/to/local/image.png",
    prompt="Describe the UI elements in this screenshot."
)
```

## Transport Types

| Type | Description |
|------|-------------|
| stdio | Runs locally, communicates via stdout |
| SSE | Can be deployed locally or in the cloud, communicates via network |

## Troubleshooting

### "Invalid API key" Error
- Verify your API key and host are from the same region (both Global or both Mainland China)

### "spawn uvx ENOENT" Error
- Run `which uvx` to find the absolute path to uvx
- Update your config to use the absolute path, e.g., `"command": "/usr/local/bin/uvx"`

## Installation Requirements

- Python package manager `uv` must be installed
- Install via: `curl -LsSf https://astral.sh/uv/install.sh | sh`
