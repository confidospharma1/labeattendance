// Copies the face models used by the app from @vladmandic/human into public/models
// so they are served locally (and bundled inside the APK for offline use).
const fs = require('fs');
const path = require('path');

const MODELS = ['blazeface', 'facemesh', 'iris', 'faceres', 'antispoof', 'liveness'];
const src = path.join(__dirname, '..', 'node_modules', '@vladmandic', 'human', 'models');
const dest = path.join(__dirname, '..', 'public', 'models');

fs.mkdirSync(dest, { recursive: true });
for (const name of MODELS) {
  for (const ext of ['.json', '.bin']) {
    const file = name + ext;
    fs.copyFileSync(path.join(src, file), path.join(dest, file));
  }
}
console.log(`Copied ${MODELS.length} face models to public/models`);
