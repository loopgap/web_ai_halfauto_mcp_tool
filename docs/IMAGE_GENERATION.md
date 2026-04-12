# 图片生成指南

> 使用 MiniMax AI 为文档生成配套图片

## 概述

AI Workbench 集成了 MiniMax-MCP 服务，支持通过 AI 生成图片，可用于：
- 文档插图
- README 配图
- 架构图
- 流程图
- UI 预览图

## 配置

### 1. 获取 API Key

1. 访问 [MiniMax 开放平台](https://platform.minimaxi.com/)
2. 注册/登录账号
3. 在控制台获取 API Key

### 2. 配置环境变量

```bash
# 在项目根目录或 skills/minimax-mcp/.env 中设置
MINIMAX_API_KEY=your_api_key_here
MINIMAX_API_HOST=https://api.minimaxi.com
```

### 3. 安装 MCP 服务

```bash
cd skills/minimax-mcp
pip install -e .  # 或按 README.md 中的步骤操作
```

## 使用方法

### Python 脚本方式

```python
# doc-image-generator.py
import asyncio
from minimax_mcp.client import MiniMaxMCPClient

async def generate_doc_image(prompt: str, output_path: str):
    client = MiniMaxMCPClient()
    result = await client.text_to_image(
        prompt=prompt,
        model="image-01",
        size="1K"
    )
    # 下载并保存图片
    await client.download_image(result.task_id, output_path)
    return output_path

# 示例：生成架构图
asyncio.run(generate_doc_image(
    prompt="Clean architecture diagram with 4 layers: View, Store, Domain, Data. Modern minimalist style, dark theme",
    output_path="docs/images/architecture-diagram.png"
))
```

### 命令行方式

```bash
# 使用 MCP 服务器
uvx minimax-mcp text_to_image --prompt "workflow diagram with DAG nodes and edges" --output workflow.png

# 或使用 Python 包
python -m minimax_mcp generate_image --prompt "dashboard screenshot mockup" --output docs/images/dashboard.png
```

## 图片需求清单

以下是需要生成配图的文档：

| 文档 | 需要的图片 | 优先级 |
|------|-----------|--------|
| README.md | 架构图、项目 logo | 高 |
| GUIDE.md | 架构图、流程图、UI 预览 | 中 |
| docs/route.md | 四层架构图、状态机图 | 中 |
| skills/*/README.md | 功能示意图 | 低 |

## 生成提示词技巧

### 架构图
```
A clean architecture diagram showing 4 horizontal layers with arrows between them.
Style: minimalist, dark background, white/indigo accents, technical illustration
```

### 流程图
```
Flowchart showing process steps connected by arrows.
Style: clean, modern, professional technical documentation
```

### UI 预览
```
Dashboard UI mockup with cards, charts, and navigation.
Style: glassmorphism, dark theme, gradient accents
```

### 状态机
```
State machine diagram with nodes and transitions.
Style: technical diagram, dark theme, professional
```

## 输出规范

- **格式**：PNG 或 WebP
- **尺寸**：根据用途选择
  - 文档内嵌：800x600 或 1024x768
  - README hero：1920x1080
- **命名**：`{文档名}-{描述}.png`
- **位置**：统一放在 `docs/images/` 目录

## 自动化

如需批量生成，可以使用脚本：

```bash
# 生成所有需要的文档图片
./scripts/generate-doc-images.sh
```

---

## 注意事项

1. **版权**：生成的图片版权归您所有，可自由使用
2. **内容**：请确保生成的图片内容准确、符合项目实际
3. **更新**：文档大幅修改时，记得同步更新配图
