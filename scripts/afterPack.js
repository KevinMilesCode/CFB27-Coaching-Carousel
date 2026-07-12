const fs = require('fs');
const path = require('path');

const KEEP_LOCALES = new Set(['en-US.pak', 'en-GB.pak']);

exports.default = async function afterPack(context) {
  const localesDir = path.join(context.appOutDir, 'locales');

  if (!fs.existsSync(localesDir)) {
    return;
  }

  for (const fileName of fs.readdirSync(localesDir)) {
    if (!KEEP_LOCALES.has(fileName)) {
      fs.unlinkSync(path.join(localesDir, fileName));
    }
  }
};
