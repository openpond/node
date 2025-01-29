import crypto from "crypto";
import fs from "fs";
import path from "path";

// Create release directory
const releaseDir = path.join(process.cwd(), "release");
if (!fs.existsSync(releaseDir)) {
  fs.mkdirSync(releaseDir);
}

// Copy the bundled node file
const nodePath = path.join(process.cwd(), "dist", "p2p-node.js");
const releaseNodePath = path.join(releaseDir, "p2p-node.js");
fs.copyFileSync(nodePath, releaseNodePath);

// Copy proto files
const protoDir = path.join(process.cwd(), "src", "proto");
const releaseProtoDir = path.join(releaseDir, "proto");
if (!fs.existsSync(releaseProtoDir)) {
  fs.mkdirSync(releaseProtoDir);
}
fs.readdirSync(protoDir).forEach((file) => {
  if (file.endsWith(".proto")) {
    fs.copyFileSync(
      path.join(protoDir, file),
      path.join(releaseProtoDir, file)
    );
  }
});

// Generate checksums
const generateChecksum = (filePath) => {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash("sha256");
  hashSum.update(fileBuffer);
  return hashSum.digest("hex");
};

const checksums = {
  "p2p-node.js": generateChecksum(releaseNodePath),
};

// Write checksums file
fs.writeFileSync(
  path.join(releaseDir, "checksums.txt"),
  Object.entries(checksums)
    .map(([file, hash]) => `${hash}  ${file}`)
    .join("\n")
);

console.log("Release files prepared in ./release directory");
console.log("Files ready for GitHub release:");
console.log("- p2p-node.js");
console.log("- proto/ directory");
console.log("- checksums.txt");
