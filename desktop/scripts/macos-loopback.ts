// WKWebView needs an ATS exception for Studio's random *.localhost booths.
// Apply before signing release wrappers, or after assembling unsigned dev apps.
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

if (process.env.ELECTROBUN_OS === "macos") {
  const dev = process.env.ELECTROBUN_BUILD_ENV === "dev";
  let bundle = process.env.ELECTROBUN_WRAPPER_BUNDLE_PATH;
  if (dev) {
    const directory = process.env.ELECTROBUN_BUILD_DIR;
    if (!directory) throw new Error("Missing Electrobun build directory");
    const apps = readdirSync(directory).filter((name) => name.endsWith(".app"));
    if (apps.length !== 1) throw new Error("Expected one development app bundle");
    bundle = join(directory, apps[0]);
  }
  // Release postPackage runs after signing. Only postWrap may change its plist.
  if (bundle) {
    const plist = join(bundle, "Contents", "Info.plist");
    const info = JSON.parse(execFileSync("/usr/bin/plutil", ["-convert", "json", "-o", "-", plist], { encoding: "utf8" }));
    const ats = info.NSAppTransportSecurity || {};
    ats.NSExceptionDomains = {
      ...ats.NSExceptionDomains,
      localhost: {
        NSIncludesSubdomains: true,
        NSExceptionAllowsInsecureHTTPLoads: true,
      },
    };
    execFileSync("/usr/bin/plutil", ["-replace", "NSAppTransportSecurity", "-json", JSON.stringify(ats), plist]);
    console.log("Studio: enabled HTTP for localhost preview domains");
  }
}
