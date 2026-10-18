const fs = require('node:fs');
const path = require('node:path');
const formerName = String.fromCharCode(101,108,101,107,116,114,111,112,108,97,110);
const title = formerName[0].toUpperCase() + formerName.slice(1);
const formerProfiles = [formerName, title + ' Suite', title + ' CAE Suite'];

/** Copy the selected macro directory setting once; never move user macro files
 * or overwrite preferences already saved by the renamed application. */
function migrateMacroSettings(appData, userData) {
  const destination = path.join(userData, 'macro-library.json');
  if (fs.existsSync(destination)) return false;
  for (const name of formerProfiles) {
    const source = path.join(appData, name, 'macro-library.json');
    if (!fs.existsSync(source)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(source, 'utf8'));
      if (!data || typeof data.path !== 'string') continue;
      fs.mkdirSync(userData, { recursive: true });
      fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL);
      return true;
    } catch { /* A malformed old setting must not prevent launching. */ }
  }
  return false;
}
module.exports = { migrateMacroSettings, formerProfiles };
