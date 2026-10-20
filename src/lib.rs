//! The application core shared by Studio's CLI and desktop main process.

pub mod runtime;
mod workspace;

pub use workspace::{App, AppManifest, Origin, Realm, Review, Snapshot, Workspace};
