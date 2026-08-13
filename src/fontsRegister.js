'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { registerFont } = require('canvas');

const FONTS_DIRECTORY = path.resolve(__dirname, '..', 'fonts');
const FONT_EXTENSIONS = new Set(['.ttf', '.otf']);

function formatFamilyName(directoryName) {
  return directoryName
    .replace(/[-_]+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
}

function getFontFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return getFontFiles(entryPath);
    }

    return FONT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
      ? [entryPath]
      : [];
  });
}

function getFontVariant(fileName) {
  const normalizedName = path.basename(fileName, path.extname(fileName)).toLowerCase();
  const bold = /(?:^|[-_\s])(bold|semibold|demibold)(?:$|[-_\s])/.test(normalizedName);
  const italic = /(?:^|[-_\s])(italic|oblique)(?:$|[-_\s])/.test(normalizedName);

  return {
    weight: bold ? 'bold' : 'normal',
    style: italic ? 'italic' : 'normal',
  };
}

function fontsRegister() {
  if (!fs.existsSync(FONTS_DIRECTORY)) {
    console.warn(`Fonts directory not found: ${FONTS_DIRECTORY}`);
    return;
  }

  const fontFiles = getFontFiles(FONTS_DIRECTORY);

  for (const fontPath of fontFiles) {
    const family = formatFamilyName(path.basename(path.dirname(fontPath)));
    const { weight, style } = getFontVariant(fontPath);

    registerFont(fontPath, { family, weight, style });
    console.log(`Font registered: ${family} (${weight}, ${style})`);
  }

  console.log(`${fontFiles.length} font(s) registered from ${FONTS_DIRECTORY}`);
}

module.exports = { fontsRegister };
