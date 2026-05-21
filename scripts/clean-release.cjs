const fs = require('node:fs');
const path = require('node:path');

const releaseDir = path.join(__dirname, '..', 'release');

if (fs.existsSync(releaseDir)) {
  fs.rmSync(releaseDir, { recursive: true, force: true });
}

console.log('Release directory cleaned:', releaseDir);
