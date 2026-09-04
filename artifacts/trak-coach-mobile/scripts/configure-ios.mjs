import { existsSync, readFileSync, writeFileSync } from "node:fs";

const root = new URL("../ios/App/App/", import.meta.url);
const plist = new URL("Info.plist", root);
const entitlements = new URL("App.entitlements", root);
const project = new URL("../App.xcodeproj/project.pbxproj", root);
if (!existsSync(plist) || !existsSync(project)) throw new Error("Run cap add ios before configuring iOS.");

let info = readFileSync(plist, "utf8");
info = info.replace(/\s*<key>CFBundleURLTypes<\/key><array><dict><key>CFBundleURLSchemes<\/key><array><string>[^<]+<\/string><\/array><\/dict><\/array>/g, "");
info = info.replace(/\n<\/dict>\n<\/plist>\s*$/, "\n\t<key>CFBundleURLTypes</key>\n\t<array><dict><key>CFBundleURLSchemes</key><array><string>trakai-coach</string></array></dict></array>\n</dict>\n</plist>\n");
writeFileSync(plist, info);
writeFileSync(entitlements, `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>aps-environment</key><string>$(APS_ENVIRONMENT)</string></dict></plist>\n`);
let pbxproj = readFileSync(project, "utf8");
if (!pbxproj.includes("CODE_SIGN_ENTITLEMENTS = App/App.entitlements;")) pbxproj = pbxproj.replace(/CODE_SIGN_STYLE = Automatic;/g, "CODE_SIGN_STYLE = Automatic;\n\t\t\t\tCODE_SIGN_ENTITLEMENTS = App/App.entitlements;");
if (!pbxproj.includes("APS_ENVIRONMENT =")) {
  let configuration = 0;
  pbxproj = pbxproj.replace(/CODE_SIGN_ENTITLEMENTS = App\/App\.entitlements;/g, match => `${match}\n\t\t\t\tAPS_ENVIRONMENT = ${configuration++ === 0 ? "development" : "production"};`);
}
writeFileSync(project, pbxproj);