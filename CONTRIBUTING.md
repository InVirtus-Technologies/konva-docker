# Contributing to invirtus/konva

Thank you for your interest! Here's everything you need to contribute.

## Development setup

**Prerequisites**: Docker (for the full build). For local dev without Docker, you need `libcairo2-dev`, `libpango1.0-dev`, `libjpeg-dev`, `libgif-dev`, `librsvg2-dev` (Debian/Ubuntu).

```bash
git clone https://github.com/YOUR_USERNAME/invirtus/konva.git
cd invirtus/konva
npm install
npm start
```

## Commit convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix       | Use for                              |
|--------------|--------------------------------------|
| `feat:`      | New feature                          |
| `fix:`       | Bug fix                              |
| `perf:`      | Performance improvement              |
| `refactor:`  | Code change without feature/fix      |
| `docs:`      | Documentation only                   |
| `ci:`        | CI / GitHub Actions changes          |
| `chore:`     | Maintenance (deps, tooling…)         |
| `build:`     | Build system (Dockerfile…)           |

Example: `feat(renderer): add support for custom fonts`

## Submitting a PR

1. Fork and create a branch: `git checkout -b feat/my-feature`
2. Make your changes
3. Test: `docker build -t invirtus/konva:dev . && docker run --rm -p 3000:3000 --read-only --tmpfs /tmp --user 1000:1000 invirtus/konva:dev`
4. Open a PR against `main`

## Releasing (maintainers only)

```bash
git tag v1.2.3
git push origin v1.2.3
```

This triggers the `docker-publish` and `release` workflows automatically.
