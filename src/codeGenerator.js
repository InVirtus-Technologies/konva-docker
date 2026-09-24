'use strict';

const bwipjs = require('bwip-js');

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
 * Maps the ESL editor's `eslCodeType` values (see
 * cloud.invirtus.io src/Enum/TwoDCodeType.php) to bwip-js symbology ids.
 */
const CODE_2D_TYPE_TO_BCID = {
  QRCODE: 'qrcode',
  DATAMATRIX: 'datamatrix',
};

const CODE_KIND_BARCODE = 'barcode';
const CODE_KIND_2D = '2dcode';

/**
 * Generates a PNG buffer for an ESL barcode / 2D-code node's attrs.
 * Returns null when the node isn't a recognized code node, so callers
 * can leave unrelated Image nodes untouched.
 *
 * The bitmap is rendered oversampled (well above the node's own
 * width/height); Konva then stretches it into the node's box exactly
 * like the editor stretches its placeholder image, so it stays crisp
 * whatever size the user picked.
 */
async function generateCodeBuffer(attrs = {}) {
  const { eslCodeKind, eslCodeValue } = attrs;

  let bcid;
  if (eslCodeKind === CODE_KIND_BARCODE) {
    bcid = BARCODE_FORMAT_TO_BCID[attrs.eslBarcodeFormat];
    if (!bcid) {
      const err = new Error(
        `Unsupported eslBarcodeFormat "${attrs.eslBarcodeFormat}". Supported: ${Object.keys(BARCODE_FORMAT_TO_BCID).join(', ')}`
      );
      err.statusCode = 400;
      throw err;
    }
  } else if (eslCodeKind === CODE_KIND_2D) {
    bcid = CODE_2D_TYPE_TO_BCID[attrs.eslCodeType];
    if (!bcid) {
      const err = new Error(
        `Unsupported eslCodeType "${attrs.eslCodeType}". Supported: ${Object.keys(CODE_2D_TYPE_TO_BCID).join(', ')}`
      );
      err.statusCode = 400;
      throw err;
    }
  } else {
    return null;
  }

  const options = {
    bcid,
    text: String(eslCodeValue ?? ''),
    scale: eslCodeKind === CODE_KIND_BARCODE ? 4 : 8,
    includetext: false,
    backgroundcolor: 'FFFFFF',
  };
  if (eslCodeKind === CODE_KIND_BARCODE) {
    options.height = 10; // mm — bar height only; final image is stretched to the node's box
  }

  try {
    return await bwipjs.toBuffer(options);
  } catch (err) {
    const wrapped = new Error(`Failed to generate ${eslCodeKind} (${bcid}) for value "${eslCodeValue}": ${err.message}`);
    wrapped.statusCode = 400;
    throw wrapped;
  }
}

module.exports = {
  generateCodeBuffer,
  BARCODE_FORMAT_TO_BCID,
  CODE_2D_TYPE_TO_BCID,
};
