'use strict';
// Runs every tests/*.test.js. Usage: node test.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'tests');
for (const f of fs.readdirSync(dir).sort()) {
  if (f.endsWith('.test.js')) require(path.join(dir, f));
}
