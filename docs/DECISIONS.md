# Architecture decisions

- **ADR-001:** external engines remain submodules/adapters; do not vendor or rewrite them.
- **ADR-002:** no still-image render fallback because the channel requires actual character/scene motion.
- **ADR-003:** local-first standard-library core; provider integrations are optional.
- **ADR-004:** work and approved assets are separate; retries must not silently overwrite approved work.
