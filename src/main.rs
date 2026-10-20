use std::path::PathBuf;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use anyhow::{Result, ensure};
use clap::{Parser, Subcommand};
use studio::{Workspace, runtime};
use uuid::Uuid;

#[derive(Parser)]
#[command(
    name = "studio",
    version,
    about = "Memoremix Studio — a workspace for remixers"
)]
struct Cli {
    #[arg(long, global = true, default_value = ".")]
    workspace: PathBuf,
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Initialize a workspace without changing an existing one.
    Init,
    /// Author a personal performer from the built-in starter.
    New {
        name: String,
        #[arg(long, default_value = "hello")]
        template: String,
    },
    /// List bundled performer templates.
    Templates,
    /// Serve the shared GUI at an authenticated loopback-only address.
    Serve {
        /// Listening port; 0 chooses an available port automatically.
        #[arg(long, default_value_t = 0)]
        port: u16,
    },
    /// Inspect the JSON key/value data of a Durable Object.
    Object {
        id: Uuid,
        namespace: String,
        name: String,
    },
    /// Copy another remixer's sample into its own solitary realm.
    Import { source: PathBuf },
    /// List booths and their current revision and realm as JSON.
    List,
    /// Display the complete source and digest to review before promotion.
    Review { id: Uuid },
    /// Trust exactly the revision returned by `review`.
    Promote {
        id: Uuid,
        #[arg(long)]
        revision: String,
    },
    /// Remove an imported sample's review grant.
    Demote { id: Uuid },
    /// Show runtime membership without executing code.
    Plan { id: Uuid },
    /// Execute one local fetch through workerd in an MXC sandbox.
    Run {
        id: Uuid,
        #[arg(long, default_value = "/")]
        path: String,
        #[arg(long, env = "STUDIO_WORKERD")]
        workerd: Option<PathBuf>,
    },
}

fn main() {
    if let Err(error) = run(Cli::parse()) {
        eprintln!("studio: {error:#}");
        std::process::exit(1);
    }
}

fn print(value: impl serde::Serialize) -> Result<()> {
    println!("{}", serde_json::to_string_pretty(&value)?);
    Ok(())
}

fn run(cli: Cli) -> Result<()> {
    if matches!(cli.command, Command::Init) {
        let workspace = Workspace::init(cli.workspace)?;
        return print(serde_json::json!({"workspace": workspace.root()}));
    }
    if matches!(cli.command, Command::Templates) {
        return print(studio::templates::list());
    }
    let workspace = Workspace::open(&cli.workspace)?;
    match cli.command {
        Command::Init => unreachable!(),
        Command::New { name, template } => print(workspace.create_from_template(&name, &template)?),
        Command::Templates => print(studio::templates::list()),
        Command::Object {
            id,
            namespace,
            name,
        } => print(workspace.object_data(id, &namespace, &name)?),
        Command::Serve { port } => {
            let cancelled = Arc::new(AtomicBool::new(false));
            let signal = cancelled.clone();
            ctrlc::set_handler(move || signal.store(true, Ordering::Release))?;
            tokio::runtime::Runtime::new()?
                .block_on(studio::server::serve(workspace, port, cancelled))
        }
        Command::Import { source } => print(workspace.import(source)?),
        Command::List => print(workspace.list()?),
        Command::Review { id } => print(workspace.review(id)?),
        Command::Promote { id, revision } => {
            workspace.promote(id, &revision)?;
            print(workspace.plan(id)?)
        }
        Command::Demote { id } => {
            workspace.demote(id)?;
            print(workspace.plan(id)?)
        }
        Command::Plan { id } => print(workspace.plan(id)?),
        Command::Run { id, path, workerd } => {
            let cancelled = Arc::new(AtomicBool::new(false));
            let signal = Arc::clone(&cancelled);
            ctrlc::set_handler(move || signal.store(true, Ordering::Release))?;
            let result = workspace.run_cancellable(
                id,
                &runtime::workerd_path(workerd)?,
                &path,
                &cancelled,
            )?;
            let code = result.exit_code;
            print(result)?;
            ensure!(code == 0, "worker execution failed with exit code {code}");
            Ok(())
        }
    }
}
