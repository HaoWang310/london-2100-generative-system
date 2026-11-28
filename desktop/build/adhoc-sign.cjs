// electron-builder afterPack hook.
// No paid Apple certificate, so the Mac app is signed "ad hoc". Without any
// signature Apple-silicon Macs report the app as "damaged"; with an ad-hoc
// signature it opens after System Settings → Privacy & Security → Open Anyway.
const { execFileSync } = require('child_process');
const path = require('path');

exports.default = async function adhocSign(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const appPath = path.join(context.appOutDir, context.packager.appInfo.productFilename + '.app');
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' });
};
