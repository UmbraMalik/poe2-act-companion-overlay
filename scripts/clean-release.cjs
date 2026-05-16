const fs = require('node:fs');
const path = require('node:path');

const releaseDir = path.resolve(__dirname, '..', 'release');

if (fs.existsSync(releaseDir)) {
  fs.rmSync(releaseDir, { recursive: true, force: true });
  console.log(`Removed ${releaseDir}`);
} else {
  console.log('release directory is already clean');
}
