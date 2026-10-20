# Memoremix Studio

A malleable content workspace with isolated app booths, built as a Rust CLI
and an Electrobun desktop app sharing a Rust core.

Studio's users are **remixers**. Remixers modify apps we author, author their
own apps, and share their work as **samples** for other remixers to explore
and remix.

## Proposed execution and trust model

Booths are grouped by trust so that each booth does not require its own
workerd process:

- **Trusted realm:** apps we ship, a remixer's personal remixes of our trusted
  code, and apps that remixer personally authored can share one workerd
  process inside an MXC-managed sandbox.
- **Other remixers' samples:** each initially runs in its own MXC-managed
  sandbox with its own workerd process, separate from the trusted realm and
  from other samples.
- **Promotion after review:** the remixer may explicitly promote a reviewed
  sample into the trusted realm. Trust applies to the reviewed revision;
  importing updates or code from another remixer requires a new trust decision.
  Making a personal copy or editing an imported sample does not automatically
  promote it.

The trusted realm shares runtime overhead and a process failure boundary.
Booths within it still have separate capability grants and storage identities;
joining it does not grant access to every other booth or to the privileged
desktop shell. Separate sandboxes contain the effects of a runtime escape in
an unreviewed sample. Studio's trusted core and credential broker remain
outside worker sandboxes.

This is the intended architecture, pending implementation and resource and
security validation. See [AGENTS.md](AGENTS.md) for implementation guidance.
