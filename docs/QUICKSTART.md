# AI Workbench Quickstart

## 首选入口

```bash
git clone https://github.com/loopgap/web_ai_halfauto_mcp_tool.git
cd web_ai_halfauto_mcp_tool

# 环境初始化
pnpm setup

# 安装依赖
pnpm install
```

## 日常命令

```bash
pnpm dev         # 启动开发服务器
pnpm build       # 构建应用
pnpm doctor      # 诊断环境
pnpm check       # 代码规范检查
pnpm test        # 运行测试
pnpm ci          # 完整本地门禁
```

## 当前支持范围

- Linux：正式支持 `apt` 系发行版的自动系统包安装
- Windows：正式支持工具链检测、引导和项目依赖闭环
- macOS：保留手动支持，但本次不纳入自动化闭环

## 常见阻断

```bash
# Linux 缺管理员权限时，脚本会输出类似命令
sudo apt-get update && sudo apt-get install -y \
  libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev patchelf
```
