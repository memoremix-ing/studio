//! The application core shared by Studio's CLI and desktop main process.

pub mod runtime;
pub mod server;
pub mod shell;
pub mod storage;
pub mod templates;
mod workspace;

pub use workspace::{App, AppManifest, Origin, Realm, Review, Snapshot, Workspace};
