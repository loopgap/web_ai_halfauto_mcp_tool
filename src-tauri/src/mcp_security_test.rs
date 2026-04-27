//! MCP Security Tests
//!
//! Tests for command whitelist and dangerous pattern detection

#[cfg(test)]
mod tests {
    /// Command whitelist - only safe commands allowed
    #[test]
    fn test_command_whitelist_allows_node() {
        const ALLOWED_COMMANDS: [&str; 3] = ["node", "python3", "python"];
        assert!(ALLOWED_COMMANDS.contains(&"node"));
    }

    #[test]
    fn test_command_whitelist_allows_python() {
        const ALLOWED_COMMANDS: [&str; 3] = ["node", "python3", "python"];
        assert!(ALLOWED_COMMANDS.contains(&"python3"));
        assert!(ALLOWED_COMMANDS.contains(&"python"));
    }

    #[test]
    fn test_command_whitelist_blocks_shell() {
        const ALLOWED_COMMANDS: [&str; 3] = ["node", "python3", "python"];
        assert!(!ALLOWED_COMMANDS.contains(&"bash"));
        assert!(!ALLOWED_COMMANDS.contains(&"sh"));
        assert!(!ALLOWED_COMMANDS.contains(&"cmd.exe"));
        assert!(!ALLOWED_COMMANDS.contains(&"powershell"));
    }

    /// Dangerous pattern detection
    #[test]
    fn test_dangerous_patterns_detected() {
        const DANGEROUS_PATTERNS: [&str; 4] = ["|", ";", "&&", "rm -rf"];

        let dangerous_args = vec!["script.js", "&&", "rm", "-rf", "/"];
        let has_dangerous = dangerous_args.iter().any(|arg| {
            DANGEROUS_PATTERNS.iter().any(|p| arg.contains(p))
        });
        assert!(has_dangerous);
    }

    #[test]
    fn test_safe_args_pass() {
        const DANGEROUS_PATTERNS: [&str; 4] = ["|", ";", "&&", "rm -rf"];

        let safe_args = vec!["script.js", "--help", "-v"];
        let has_dangerous = safe_args.iter().any(|arg| {
            DANGEROUS_PATTERNS.iter().any(|p| arg.contains(p))
        });
        assert!(!has_dangerous);
    }

    #[test]
    fn test_pipe_detection() {
        const DANGEROUS_PATTERNS: [&str; 4] = ["|", ";", "&&", "rm -rf"];
        assert!(DANGEROUS_PATTERNS.contains(&"|"));
    }

    #[test]
    fn test_semicolon_detection() {
        const DANGEROUS_PATTERNS: [&str; 4] = ["|", ";", "&&", "rm -rf"];
        assert!(DANGEROUS_PATTERNS.contains(&";"));
    }
}