import { execSync } from "child_process";
import fs from "fs";
import path from "path";

// Read current version
const packageJson = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8")
);

// Get version type from args (patch, minor, major)
const versionType = process.argv[2] || "patch";

// Get current version parts
const [major, minor, patch] = packageJson.version.split(".").map(Number);

// Calculate new version
let newVersion;
switch (versionType) {
  case "major":
    newVersion = `${major + 1}.0.0`;
    break;
  case "minor":
    newVersion = `${major}.${minor + 1}.0`;
    break;
  case "patch":
  default:
    newVersion = `${major}.${minor}.${patch + 1}`;
}

// Update package.json
packageJson.version = newVersion;
fs.writeFileSync(
  path.join(process.cwd(), "package.json"),
  JSON.stringify(packageJson, null, 2) + "\n"
);

// Create git tag
execSync(`git add package.json`);
execSync(`git commit -m "chore: bump version to ${newVersion}"`);
execSync(`git tag -a v${newVersion} -m "Release v${newVersion}"`);

console.log(`Version bumped to ${newVersion}`);
console.log("Git tag created");
console.log('Run "npm run release" to push changes and trigger release');
