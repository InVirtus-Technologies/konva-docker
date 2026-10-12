'use strict';

const bwipjs = require('bwip-js');
const { createCanvas } = require('canvas');

/**
 * Maps the ESL editor's `eslBarcodeFormat` values (see
 * cloud.invirtus.io src/Enum/BarcodeType.php) to bwip-js symbology ids.
 */
const BARCODE_FORMAT_TO_BCID = {
  CODE128: 'code128',
  EAN13: 'ean13',
  EAN8: 'ean8',
  UPC: 'upca',
  CODE39: 'code39',
  ITF14: 'itf14',
};

/**
 * Maps the ESL editor's `codeType` values (see
 * cloud.invirtus.io src/Enum/TwoDCodeType.php) to bwip-js symbology ids.
 */
const CODE_2D_TYPE_TO_BCID = {
  QRCODE: 'qrcode',
  DATAMATRIX: 'datamatrix',
};

const CODE_KIND_BARCODE = 'barcode';
const CODE_KIND_2D = '2dcode';

/**
 * Colors a code (and its background) may use: the ESL screen colors.
 */
const CODE_COLORS = ['#000000', '#ffffff', '#ff0000'];
const DEFAULT_CODE_COLOR = '#000000';
const DEFAULT_CODE_BACKGROUND_COLOR = '#ffffff';

/**
 * Returns a code color attr, normalized, or its default when it isn't set.
 */
function codeColorAttr(attrs, name, defaultColor) {
  if (attrs[name] === undefined || attrs[name] === null || attrs[name] === '') {
    return defaultColor;
  }
  const color = String(attrs[name]).toLowerCase();
  if (!CODE_COLORS.includes(color)) {
    const err = new Error(`Unsupported ${name} "${attrs[name]}". Supported: ${CODE_COLORS.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }

  return color;
}

/**
 * Encodes an ESL barcode / 2D-code node's attrs into its raw module layout.
 * Returns null when the node isn't a recognized code node, so callers
 * can leave unrelated Image nodes untouched.
 *
 * - 2D codes: `{ kind: '2dcode', columns, rows, modules }`, `modules` being
 *   the row-major dark (1) / light (0) matrix.
 * - Barcodes: `{ kind: 'barcode', widths }`, the alternating bar / space
 *   widths (in modules), starting with a bar.
 *
 * Both also carry `color` / `backgroundColor`, from the `codeColor` /
 * `codeBackgroundColor` attrs (black on white by default).
 */
function encodeCode(attrs = {}) {
  const { codeKind, codeValue } = attrs;

  let bcid;
  if (codeKind === CODE_KIND_BARCODE) {
    bcid = BARCODE_FORMAT_TO_BCID[attrs.eslBarcodeFormat];
    if (!bcid) {
      const err = new Error(
        `Unsupported eslBarcodeFormat "${attrs.eslBarcodeFormat}". Supported: ${Object.keys(BARCODE_FORMAT_TO_BCID).join(', ')}`
      );
      err.statusCode = 400;
      throw err;
    }
  } else if (codeKind === CODE_KIND_2D) {
    bcid = CODE_2D_TYPE_TO_BCID[attrs.codeType];
    if (!bcid) {
      const err = new Error(
        `Unsupported codeType "${attrs.codeType}". Supported: ${Object.keys(CODE_2D_TYPE_TO_BCID).join(', ')}`
      );
      err.statusCode = 400;
      throw err;
    }
  } else {
    return null;
  }

  const color = codeColorAttr(attrs, 'codeColor', DEFAULT_CODE_COLOR);
  const backgroundColor = codeColorAttr(attrs, 'codeBackgroundColor', DEFAULT_CODE_BACKGROUND_COLOR);

  let symbol;
  try {
    [symbol] = bwipjs.raw({ bcid, text: String(codeValue ?? '') });
  } catch (err) {
    const wrapped = new Error(`Failed to generate ${codeKind} (${bcid}) for value "${codeValue}": ${err.message}`);
    wrapped.statusCode = 400;
    throw wrapped;
  }

  if (codeKind === CODE_KIND_2D) {
    return { kind: CODE_KIND_2D, columns: symbol.pixx, rows: symbol.pixy, modules: symbol.pixs, color, backgroundColor };
  }

  return { kind: CODE_KIND_BARCODE, widths: symbol.sbs, color, backgroundColor };
}

/**
 * Size of one module, in pixels, for a symbol of `moduleCount` modules drawn
 * over `available` pixels.
 *
 * Every module gets the same whole number of pixels whenever it fits (the
 * symbol is then centered in its box), so the output only contains pure
 * dark / light pixels and all modules have the exact same size: stretching
 * a bitmap instead blurs module edges into grey pixels, which ESL screens
 * can't display. Only when the box is smaller than one pixel per module is a
 * fractional size kept (edges are then rounded: still pure colors, but
 * uneven modules).
 */
function moduleSize(moduleCount, available) {
  const size = available / moduleCount;

  return size >= 1 ? Math.floor(size) : size;
}

/**
 * Draws an encoded code onto a canvas of exactly `width` x `height` pixels,
 * aligned on the pixel grid, with the code's colors.
 *
 * @param {object} code   - Result of encodeCode()
 * @param {number} width  - in pixels
 * @param {number} height - in pixels
 * @returns {import('canvas').Canvas}
 */
function drawCode(code, width, height) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.antialias = 'none';

  ctx.fillStyle = code.backgroundColor;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = code.color;

  if (code.kind === CODE_KIND_2D) {
    // Square modules: same module size on both axes.
    const size = Math.min(moduleSize(code.columns, width), moduleSize(code.rows, height));
    const offsetX = Math.floor((width - size * code.columns) / 2);
    const offsetY = Math.floor((height - size * code.rows) / 2);
    const edgeX = (column) => offsetX + Math.round(column * size);
    const edgeY = (row) => offsetY + Math.round(row * size);

    for (let row = 0; row < code.rows; row++) {
      for (let column = 0; column < code.columns; column++) {
        if (code.modules[row * code.columns + column]) {
          ctx.fillRect(edgeX(column), edgeY(row), edgeX(column + 1) - edgeX(column), edgeY(row + 1) - edgeY(row));
        }
      }
    }

    return canvas;
  }

  // Barcode: bars fill the whole height, only the horizontal axis is gridded.
  const totalModules = code.widths.reduce((sum, w) => sum + w, 0);
  const size = moduleSize(totalModules, width);
  const offsetX = Math.floor((width - size * totalModules) / 2);
  const edgeX = (position) => offsetX + Math.round(position * size);

  let position = 0;
  code.widths.forEach((w, index) => {
    if (index % 2 === 0) {
      ctx.fillRect(edgeX(position), 0, edgeX(position + w) - edgeX(position), height);
    }
    position += w;
  });

  return canvas;
}

module.exports = {
  encodeCode,
  drawCode,
  BARCODE_FORMAT_TO_BCID,
  CODE_2D_TYPE_TO_BCID,
};
