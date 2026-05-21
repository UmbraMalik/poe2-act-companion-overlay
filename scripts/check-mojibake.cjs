#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const scanRoot = path.join(root, 'src');
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.html', '.md']);

const latinMojibakeRe = /[\u00c2\u00c3\u00d0\u00d1\ufffd]|\u00e2[\u0080-\u009f]/;
const cyrillicMojibakeRe = new RegExp([
  '\\u0420[\\u0406\\u0455\\u00b1\\u00bb\\u00b0\\u00b5\\u0405\\u0491\\u0454\\u0451\\u0457\\u045e]',
  '\\u0421[\\u0403\\u201a\\u040a\\u2039\\u20ac\\u2026\\u0402\\u0453\\u2021\\u040f]'
].join('|'));

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
      continue;
    }
    if (entry.isFile() && extensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

const offenders = [];

for (const file of walk(scanRoot)) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (latinMojibakeRe.test(line) || cyrillicMojibakeRe.test(line)) {
      offenders.push({
        file: path.relative(root, file).replace(/\\/g, '/'),
        line: index + 1,
        text: line.trim().slice(0, 180)
      });
    }
  });
}

if (offenders.length > 0) {
  console.error('[check:mojibake] Source files contain likely broken encoding:');
  for (const offender of offenders) {
    console.error(`  - ${offender.file}:${offender.line} ${offender.text}`);
  }
  process.exit(1);
}

console.log('[check:mojibake] No mojibake found in source files.');
