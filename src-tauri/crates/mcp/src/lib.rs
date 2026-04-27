//! MCP (Model Context Protocol) Server 实现
//!
//! 提供 STDIO 传输层的 MCP 协议处理器

use rmcp::tool;
use rmcp::tool_router;
use rmcp::handler::server::wrapper::Parameters;
use rmcp::{ServiceExt, transport::stdio};
use rmcp::schemars::JsonSchema;
use serde::Deserialize;
use std::error::Error;

/// Echo 请求参数
#[derive(Debug, Deserialize, JsonSchema)]
pub struct EchoRequest {
    pub message: String,
}

/// MCP 服务器实例
#[derive(Clone)]
pub struct McpServer;

#[allow(dead_code)]
const SERVER_NAME: &str = "ai-workbench-mcp";
#[allow(dead_code)]
const SERVER_VERSION: &str = "0.1.0";

#[tool_router(server_handler)]
impl McpServer {
    /// Ping 工具 - 检查服务器连通性
    #[tool(description = "Ping 服务器检查连通性")]
    fn ping(&self) -> String {
        "pong".to_string()
    }

    /// Echo 工具 - 回显消息
    #[tool(description = "回显传入的消息")]
    fn echo(&self, Parameters(req): Parameters<EchoRequest>) -> String {
        format!("Echo: {}", req.message)
    }
}

/// 启动 MCP STDIO 服务器
pub async fn start_server() -> Result<(), Box<dyn Error>> {
    let service = McpServer.serve(stdio()).await?;
    service.waiting().await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ping_tool() {
        let server = McpServer;
        let result = server.ping();
        assert_eq!(result, "pong");
    }

    #[test]
    fn test_echo_tool() {
        let server = McpServer;
        let req = EchoRequest {
            message: "hello".to_string(),
        };
        let result = server.echo(Parameters(req));
        assert_eq!(result, "Echo: hello");
    }

    #[test]
    fn test_echo_tool_empty_message() {
        let server = McpServer;
        let req = EchoRequest {
            message: "".to_string(),
        };
        let result = server.echo(Parameters(req));
        assert_eq!(result, "Echo: ");
    }
}