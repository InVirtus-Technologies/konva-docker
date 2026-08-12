# konva-renderer

> **Konva.js server-side rendering as a microservice.**  
> Send a Konva stage JSON → get back a PNG / JPEG / WebP image.

[![CI](https://github.com/YOUR_USERNAME/invirtus/konva/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_USERNAME/invirtus/konva/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Features

- 🖼️ **Full Konva SSR** — renders any Konva stage (shapes, groups, layers, transforms, shadows, gradients…)
- 📐 **Hi-DPI support** — `pixelRatio` parameter for @2x / @3x output
- 🎨 **Multi-format** — PNG, JPEG, WebP
- 🔒 **Rootless** — runs as uid=1000, `readOnlyRootFilesystem`, `capabilities: drop ALL`
- ☸️ **Kubernetes-ready** — Deployment + Service + HPA manifests included
- 🔄 **Auto-updated deps** — Dependabot watches npm, Docker and GitHub Actions weekly

---

## Quick start

```bash
docker run --rm -p 3000:3000 \
  --read-only --tmpfs /tmp --user 1000:1000 \
  invirtus/konva:latest

curl -X POST http://localhost:3000/render \
  -H 'Content-Type: application/json' \
  -d @example-payload.json \
  --output result.png
```

---

## API

### `POST /render`

**Body** (`application/json`):

| Field        | Type    | Default | Description                                      |
|--------------|---------|---------|--------------------------------------------------|
| `stage`      | object  | —       | **Required.** Konva stage descriptor             |
| `format`     | string  | `png`   | Output format: `png` \| `jpeg` \| `webp`         |
| `quality`    | number  | `0.92`  | Quality for JPEG/WebP (0–1)                      |
| `pixelRatio` | number  | `1`     | Resolution multiplier (e.g. `2` = @2x)           |

**Response**: binary `image/png` (or chosen format)

**Error responses**:

| Code | Reason                                       |
|------|----------------------------------------------|
| 400  | Missing `stage`, bad format, no width/height |
| 500  | Internal render error                        |

### `GET /healthz` — Liveness probe

```json
{ "status": "ok" }
```

### `GET /readyz` — Readiness probe

```json
{ "status": "ready" }
```

---

## Generating the stage JSON

In your browser app:

```js
const stage = new Konva.Stage({ container: 'myDiv', width: 800, height: 600 });
const layer = new Konva.Layer();
layer.add(new Konva.Circle({ x: 400, y: 300, radius: 100, fill: '#e94560' }));
stage.add(layer);
layer.draw();

// Send to the microservice
const resp = await fetch('http://konva-renderer/render', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ stage: stage.toObject(), format: 'png', pixelRatio: 2 }),
});
const blob = await resp.blob();
document.querySelector('img').src = URL.createObjectURL(blob);
```

---

## Build

```bash
docker build -t invirtus/konva:latest .

# Run rootless (mirrors production)
docker run --rm -p 3000:3000 \
  --read-only --tmpfs /tmp --user 1000:1000 \
  invirtus/konva:latest
```

> The Dockerfile uses a **multi-stage build**: native canvas libraries are compiled in the `deps` stage, only the runtime `.so` files are copied to the final image.

---
## Environment variables

| Variable     | Default      | Description                    |
|--------------|--------------|--------------------------------|
| `PORT`       | `3000`       | Listening port                 |
| `HOST`       | `0.0.0.0`   | Listening address              |
| `LOG_LEVEL`  | `info`       | Pino log level                 |
| `BODY_LIMIT` | `10mb`       | Max JSON body size             |
| `NODE_ENV`   | `production` | Node environment               |

---

## CI / CD

| Workflow            | Trigger                         | Description                                  |
|---------------------|---------------------------------|----------------------------------------------|
| `ci.yml`            | Push / PR on `main`             | Lint, `npm audit`, Docker build + smoke test |
| `docker-publish.yml`| Push tag `v*.*.*`               | Multi-arch build, push to GHCR, cosign sign  |
| `release.yml`       | Push tag `v*.*.*`               | Auto-generate GitHub Release with changelog  |

## Automatic dependency updates

[Dependabot](.github/dependabot.yml) runs every **Monday at 08:00 Europe/Paris** and opens PRs to update:

- **npm** packages (minor + patch updates grouped)
- **GitHub Actions** versions
- **Docker base image** (`node:20-bookworm-slim`)

---

## Supported Konva features

Everything Konva supports in SSR mode via `node-canvas`:

- Shapes: `Rect`, `Circle`, `Ellipse`, `Line`, `Arrow`, `Text`, `Path`, `Star`, `RegularPolygon`, `Wedge`, `Ring`, `Arc`…
- Transformations: rotation, scale, skew, offset
- Groups and multiple layers
- Opacity, shadows, linear/radial gradients
- Konva filters

> **Note on remote images**: `Konva.Image` shapes with remote URLs are not automatically fetched. Pre-encode your images as base64 or extend `renderer.js` to resolve URLs before building the stage.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
