# PlayLoop build sandbox

This Worker compiles generated Phaser projects inside a disposable Cloudflare Linux container. It accepts only PlayLoop project manifests, rejects path traversal and non-allowlisted dependencies, disables dependency install scripts, enforces command timeouts and memory limits, injects no application secrets, and destroys the sandbox after every build.

Deploy from this directory with `npx wrangler deploy`. Store `SANDBOX_API_KEY` as a Worker secret. Configure the main application with `SANDBOX_BUILD_URL` and the matching `SANDBOX_API_KEY` through hosted runtime secrets.
