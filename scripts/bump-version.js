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
  // Check for uncommitted changes
  const status = execSync("git status --porcelain").toString().trim();
  if (status) {
    console.error(
      "Error: You have uncommitted changes. Please commit or stash them first."
    );
    console.error(status);
    process.exit(1);
  }

  // Make sure we're on main/master and up to date
  const currentBranch = execSync("git branch --show-current").toString().trim();
  if (currentBranch !== "main" && currentBranch !== "master") {
    console.error(
      `Not on main/master branch. Current branch: ${currentBranch}`
    );
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

  // Commit, tag and push
  execSync("git add package.json");
  execSync(`git commit -m "chore: release ${newVersion}"`);
  execSync(`git tag -a v${newVersion} -m "Release ${newVersion}"`);
  execSync("git push --follow-tags");

  console.log(`\nReleased v${newVersion}`);
  console.log("GitHub Actions will create the release at:");
  console.log("https://github.com/openpond/p2p/actions");
} catch (error) {
  console.error("Error:", error.message);
  process.exit(1);
}
