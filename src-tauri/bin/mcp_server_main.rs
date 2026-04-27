//! Standalone MCP Server entry point

use std::path::PathBuf;
use clap::Parser;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use std::sync::{Arc, Mutex, OnceLock};

#[derive(Clone)]
#[allow(dead_code)]
struct StandaloneContext {
    config_base: PathBuf,
    audit_dir: PathBuf,
}

#[allow(dead_code)]
impl StandaloneContext {
    fn new(config_base: PathBuf, audit_dir: PathBuf) -> Self {
        Self { config_base, audit_dir }
    }
    fn config_base(&self) -> PathBuf { self.config_base.clone() }
    fn audit_dir(&self) -> PathBuf { self.audit_dir.clone() }
}

#[allow(dead_code)]
trait AppContextTrait: Send + Sync {
    fn config_base(&self) -> PathBuf;
    fn audit_dir(&self) -> PathBuf;
}

impl AppContextTrait for StandaloneContext {
    fn config_base(&self) -> PathBuf { self.config_base.clone() }
    fn audit_dir(&self) -> PathBuf { self.audit_dir.clone() }
}

static APP_CONTEXT: OnceLock<Mutex<Option<Arc<dyn AppContextTrait>>>> = OnceLock::new();

fn init_context(ctx: Arc<dyn AppContextTrait>) -> Result<(), &'static str> {
    APP_CONTEXT.get_or_init(|| Mutex::new(None));
    let mut guard = APP_CONTEXT.get().unwrap().lock().map_err(|_| "Lock poisoned")?;
    *guard = Some(ctx);
    Ok(())
}

fn get_context() -> Option<Arc<dyn AppContextTrait>> {
    APP_CONTEXT.get().and_then(|m| m.lock().ok()?.clone())
}

#[derive(Parser, Debug)]
#[command(author, version, about = "Standalone MCP Server", long_about = None)]
struct Args {
    #[arg(long, default_value = "./config")]
    config_dir: PathBuf,
    #[arg(long)]
    audit_dir: Option<PathBuf>,
    #[arg(short, long)]
    verbose: bool,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args = Args::parse();

    let log_level = if args.verbose { "debug" } else { "info" };
    tracing_subscriber::registry()
        .with(tracing_subscriber::fmt::layer())
        .with(tracing_subscriber::EnvFilter::new(log_level))
        .init();

    let config_base = if args.config_dir.file_name().unwrap_or_default() == "config" {
        args.config_dir.parent().unwrap_or(&args.config_dir).to_path_buf()
    } else {
        args.config_dir.clone()
    };

    let audit_dir = args.audit_dir.unwrap_or_else(|| config_base.join("audit"));
    std::fs::create_dir_all(&audit_dir)?;

    let ctx = StandaloneContext::new(config_base.clone(), audit_dir.clone());
    init_context(Arc::new(ctx.clone())).map_err(|e| format!("Failed: {}", e))?;

    tracing::info!("Starting standalone MCP Server");
    tracing::info!("Config base: {:?}", config_base);
    tracing::info!("Audit dir: {:?}", audit_dir);

    if let Some(ctx) = get_context() {
        tracing::info!("Context OK: {:?}", ctx.config_base());
    }

    tracing::info!("MCP Server ready");
    Ok(())
}