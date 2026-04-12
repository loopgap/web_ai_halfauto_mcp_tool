# MiniMax-MCP Integration Guide

This document explains how to integrate MiniMax-MCP tools into your project.

## Overview

MiniMax-MCP provides a Model Context Protocol (MCP) server that enables text-to-speech, voice cloning, video generation, image generation, and music generation capabilities through MiniMax's API.

## Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `MINIMAX_API_KEY` | Your MiniMax API key | Yes | - |
| `MINIMAX_API_HOST` | API endpoint URL | Yes | - |
| `MINIMAX_MCP_BASE_PATH` | Local output directory for generated files | No | ~/Desktop |
| `MINIMAX_API_RESOURCE_MODE` | How resources are provided (`url` or `local`) | No | `url` |

### Regional Configuration

| Region | API Host | Key Source |
|--------|----------|------------|
| Global | `https://api.minimax.io` | [MiniMax Global](https://www.minimax.io/platform/user-center/basic-information/interface-key) |
| Mainland China | `https://api.minimaxi.com` | [MiniMax CN](https://platform.minimaxi.com/user-center/basic-information/interface-key) |

**Important**: API key and host must match by region. Using an incorrect combination will result in "Invalid API key" errors.

## MCP Server Configuration

### stdio Transport (Recommended for local development)

```json
{
  "mcpServers": {
    "MiniMax": {
      "command": "uvx",
      "args": ["minimax-mcp"],
      "env": {
        "MINIMAX_API_KEY": "your-api-key-here",
        "MINIMAX_API_HOST": "https://api.minimax.io",
        "MINIMAX_MCP_BASE_PATH": "/your/output/directory",
        "MINIMAX_API_RESOURCE_MODE": "url"
      }
    }
  }
}
```

### SSE Transport (For cloud deployment)

```json
{
  "mcpServers": {
    "MiniMax": {
      "command": "uvx",
      "args": ["minimax-mcp", "--transport", "sse", "--port", "8080"],
      "env": {
        "MINIMAX_API_KEY": "your-api-key-here",
        "MINIMAX_API_HOST": "https://api.minimax.io"
      }
    }
  }
}
```

## Available Tools

### text_to_audio
Convert text to audio using a specified voice.

**Parameters:**
- `text` (string): Text to convert to speech
- `voice_id` (string): Voice ID to use
- `output_file` (string, optional): Output file path

**Example:**
```
text_to_audio with voice "female_voice_01", say "Hello, this is a test of the MiniMax text to audio system."
```

### list_voices
List all available voices for text-to-speech.

**Example:**
```
list_voices
```

### voice_clone
Clone a voice from provided audio files.

**Parameters:**
- `audio_files` (array): Array of audio file paths (2-5 files recommended)
- `voice_name` (string): Name for the cloned voice

**Example:**
```
voice_clone from audio files ["sample1.wav", "sample2.wav"], name the voice "my_clone"
```

### generate_video
Generate a video from a text prompt.

**Parameters:**
- `prompt` (string): Text description of the video to generate
- `duration` (string, optional): Video duration - `6s` or `10s` (default: `6s`)
- `resolution` (string, optional): Video resolution - `768P` or `1080P` (default: `768P`)
- `model` (string, optional): Model to use - `MiniMax-Hailuo-01` or `MiniMax-Hailuo-02` (default: `MiniMax-Hailuo-02`)

**Example:**
```
generate_video with prompt "A sunset over the ocean with waves crashing on the beach"
```

### text_to_image
Generate an image from a text prompt.

**Parameters:**
- `prompt` (string): Text description of the image to generate
- `aspect_ratio` (string, optional): Image aspect ratio
- `resolution` (string, optional): Image resolution

**Example:**
```
text_to_image with prompt "A beautiful landscape with mountains and a lake"
```

### query_video_generation
Query the status of a video generation task.

**Parameters:**
- `task_id` (string): The task ID returned from generate_video

**Example:**
```
query_video_generation for task "task_12345"
```

### music_generation
Generate a music track from a prompt and optional lyrics.

**Parameters:**
- `prompt` (string): Description of the music style/mood
- `lyrics` (string, optional): Song lyrics

**Example:**
```
music_generation with prompt "Upbeat pop song", lyrics "This is my song"
```

### voice_design
Generate a custom voice from a descriptive prompt.

**Parameters:**
- `prompt` (string): Description of the voice characteristics
- `preview_text` (string, optional): Text to preview the voice

**Example:**
```
voice_design with prompt "A warm, friendly female voice with a slight British accent"
```

## Usage Patterns for This Project

### Pattern 1: Text-to-Speech Pipeline

1. Use `list_voices` to discover available voices
2. Use `text_to_audio` to convert your text

### Pattern 2: Voice Cloning Pipeline

1. Prepare 2-5 audio samples of the source voice
2. Use `voice_clone` to create a custom voice
3. Use the cloned voice_id with `text_to_audio`

### Pattern 3: Video Generation Pipeline

1. Use `generate_video` with your prompt
2. The task returns a `task_id`
3. Use `query_video_generation` to check status
4. When complete, retrieve the generated video

### Pattern 4: Content Generation Pipeline

1. Use `text_to_image` for static images
2. Use `generate_video` for video content
3. Use `music_generation` for audio content

## Installation

### Prerequisites

- Python 3.10+
- `uv` package manager

Install uv:
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

### Verify Installation

```bash
which uvx
```

If uvx is not in your PATH, use the absolute path in your MCP configuration.

## Troubleshooting

### "invalid api key" Error
- Ensure your `MINIMAX_API_KEY` and `MINIMAX_API_HOST` are from the same region
- Global: key from minimax.io + host https://api.minimax.io
- China: key from minimaxi.com + host https://api.minimaxi.com

### "spawn uvx ENOENT" Error
- Run `which uvx` to find the absolute path
- Update config to use full path: `"command": "/full/path/to/uvx"`

## Files in This Package

```
skills/minimax-mcp/
├── README.md              # Original English documentation
├── README-CN.md           # Chinese documentation
├── README_INTEGRATION.md  # This file
├── mcp_server_config_demo.json  # Example MCP configuration
├── minimax_mcp/           # Python source code
│   ├── __init__.py
│   ├── __main__.py
│   ├── client.py
│   ├── const.py
│   ├── exceptions.py
│   ├── server.py
│   └── utils.py
├── scripts/               # Utility scripts
├── tests/                 # Test files
├── pyproject.toml
├── setup.py
├── LICENSE
└── uv.lock
```
