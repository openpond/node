import { execSync } from "child_process";
import fs from "fs";
import path from "path";

// Get version type from args (patch, minor, major)
const versionType = process.argv[2];
if (!versionType || !["patch", "minor", "major"].includes(versionType)) {
  console.error("Usage: node bump-version.js <patch|minor|major>");
  process.exit(1);
}

try {
  // First ensure we're up to date with master
  console.log("Updating master branch...");
  execSync("git checkout master");
  execSync("git pull");

  // Check for uncommitted changes
  const status = execSync("git status --porcelain").toString().trim();
  if (status) {
    console.error(
      "Error: You have uncommitted changes. Please commit or stash them first."
    );
    console.error(status);
    process.exit(1);
  }

  // Read current version
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8")
  );
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
      newVersion = `${major}.${minor}.${patch + 1}`;
  }

  console.log(`Updating version: ${packageJson.version} → ${newVersion}`);

  // Update package.json
  packageJson.version = newVersion;
  fs.writeFileSync(
    path.join(process.cwd(), "package.json"),
    JSON.stringify(packageJson, null, 2) + "\n"
  );

  // Commit changes, create and push tag
  execSync("git add package.json");
  execSync(`git commit -m "chore: release ${newVersion}"`);
  execSync(`git tag -a v${newVersion} -m "Release ${newVersion}"`);
  execSync("git push --follow-tags");

  console.log("\n✨ Version bump complete!");
  console.log(`Release workflow will be triggered by tag v${newVersion}`);
} catch (error) {
  console.error("Error during version bump:", error.message);
  process.exit(1);
}
