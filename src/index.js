'use strict';

const http = require('http');
const express = require('express');
const pino = require('pino');
const pinoHttp = require('pino-http');
const { render } = require('./renderer');

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(process.env.NODE_ENV !== 'production' && {
    transport: { target: 'pino-pretty' },
  }),
});

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
const app = express();

app.use(pinoHttp({ logger }));

// Parse JSON body — limit configurable via env (default 10 MB)
app.use(express.json({ limit: process.env.BODY_LIMIT || '10mb' }));

// ---------------------------------------------------------------------------
// Health / readiness
// ---------------------------------------------------------------------------
app.get('/healthz', (_req, res) => res.json({ status: 'ok' }));
app.get('/readyz', (_req, res) => res.json({ status: 'ready' }));

// ---------------------------------------------------------------------------
// Render endpoint
// POST /render
//
// Body (application/json):
// {
//   "stage": { ... },        // Konva stage descriptor (required)
//   "format": "png",         // png | jpeg | webp  (optional, default: png)
//   "quality": 0.92,         // 0–1  (optional, jpeg/webp only)
//   "pixelRatio": 1          // >0   (optional, default: 1)
// }
//
// Response: image/png (or chosen format) binary
// ---------------------------------------------------------------------------
app.post('/render', async (req, res) => {
  const { stage, format, quality, pixelRatio } = req.body || {};

  if (!stage) {
    return res.status(400).json({ error: '"stage" field is required' });
  }

  try {
    const { buffer, mimeType } = await render(stage, {
      format: format || 'png',
      quality: quality != null ? Number(quality) : undefined,
      pixelRatio: pixelRatio != null ? Number(pixelRatio) : undefined,
    });

    res.set({
      'Content-Type': mimeType,
      'Content-Length': buffer.length,
      'Cache-Control': 'no-store',
    });
    return res.end(buffer);
  } catch (err) {
    const status = err.statusCode || 500;
    req.log.error({ err }, 'render failed');
    return res.status(status).json({ error: err.message });
  }
});

// 404 fallback
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

const server = http.createServer(app);

// Graceful shutdown
function shutdown(signal) {
  logger.info({ signal }, 'shutting down');
  server.close(() => {
    logger.info('server closed');
    process.exit(0);
  });
  // Force exit after 10 s
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

server.listen(PORT, HOST, () => {
  logger.info({ host: HOST, port: PORT }, 'konva-renderer listening');
});
