const fs = require('node:fs');
const path = require('node:path');

const electronOutDir = path.join(__dirname, '..', 'dist-electron');

fs.rmSync(electronOutDir, { recursive: true, force: true });
