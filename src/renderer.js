'use strict';

// Must be required BEFORE konva so it registers the canvas backend
const { createCanvas, loadImage } = require('canvas');

// Expose createCanvas globally so Konva's internal env check finds it
global.createCanvas = createCanvas;

const Konva = require('konva').default;

/**
 * Supported output formats and their MIME types
 */
const FORMAT_MIME = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

/**
 * Rehydrate a Konva Stage from its plain-object descriptor.
 * Konva.Node.create() handles the full tree recursively.
 *
 * @param {object} descriptor - Result of stage.toObject() / stage.toJSON()
 * @returns {Konva.Stage}
 */
function buildStage(descriptor) {
  return Konva.Node.create(descriptor);
}

/**
 * Render a Konva stage descriptor to an image Buffer.
 *
 * @param {object|string} stageDescriptor  - Konva Stage JSON descriptor
 * @param {object}        [options]
 * @param {'png'|'jpeg'|'webp'} [options.format='png']
 * @param {number}        [options.quality=0.92]    - 0–1 for jpeg/webp
 * @param {number}        [options.pixelRatio=1]    - >0
 * @returns {Promise<{buffer: Buffer, mimeType: string}>}
 */
async function render(stageDescriptor, options = {}) {
  const {
    format = 'png',
    quality = 0.92,
    pixelRatio = 1,
  } = options;

  // --- Validate format ---
  if (!FORMAT_MIME[format]) {
    const err = new Error(`Unsupported format "${format}". Supported: ${Object.keys(FORMAT_MIME).join(', ')}`);
    err.statusCode = 400;
    throw err;
  }

  // --- Parse if string ---
  const descriptor = typeof stageDescriptor === 'string'
    ? JSON.parse(stageDescriptor)
    : stageDescriptor;

  // --- Basic validation ---
  if (!descriptor || descriptor.className !== 'Stage') {
    const err = new Error('Root node must be a Konva Stage (className: "Stage")');
    err.statusCode = 400;
    throw err;
  }

  const { width, height } = descriptor.attrs || {};
  if (!width || !height || width <= 0 || height <= 0) {
    const err = new Error('Stage attrs must include positive "width" and "height"');
    err.statusCode = 400;
    throw err;
  }

  const pr = Math.max(0.1, Number(pixelRatio) || 1);
  const canvasW = Math.round(width * pr);
  const canvasH = Math.round(height * pr);

  // --- Build stage (Konva SSR mode) ---
  // In SSR mode Konva creates offscreen canvases via global.createCanvas
  const stage = buildStage(descriptor);

  // --- Composite all layers onto one canvas ---
  const outputCanvas = createCanvas(canvasW, canvasH);
  const ctx = outputCanvas.getContext('2d');

  if (pr !== 1) {
    ctx.scale(pr, pr);
  }

  const layers = stage.getLayers();
  for (const layer of layers) {
    // Each layer has its own canvas; draw it onto ours
    const layerCanvas = layer.getNativeCanvasElement
      ? layer.getNativeCanvasElement()
      : layer.canvas._canvas;
    if (layerCanvas) {
      ctx.drawImage(layerCanvas, 0, 0);
    }
  }

  // Free Konva resources
  stage.destroy();

  // --- Encode ---
  const mimeType = FORMAT_MIME[format];
  let buffer;

  if (format === 'png') {
    buffer = outputCanvas.toBuffer('image/png');
  } else if (format === 'jpeg') {
    buffer = outputCanvas.toBuffer('image/jpeg', { quality: Number(quality) });
  } else {
    // webp — node-canvas supports it
    buffer = outputCanvas.toBuffer('image/webp', { quality: Number(quality) });
  }

  return { buffer, mimeType };
}

module.exports = { render };
