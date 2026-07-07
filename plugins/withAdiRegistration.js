const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

module.exports = function withAdiRegistration(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const sourcePath = path.join(
        config.modRequest.projectRoot,
        "assets",
        "adi-registration.properties",
      );
      const targetDir = path.join(
        config.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "assets",
      );
      const targetPath = path.join(targetDir, "adi-registration.properties");

      fs.mkdirSync(targetDir, { recursive: true });
      fs.copyFileSync(sourcePath, targetPath);

      return config;
    },
  ]);
};
