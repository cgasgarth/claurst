const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const https = require("node:https");
const { execFileSync } = require("node:child_process");

const packageJson = require("../package.json");

const TARGETS = {
  darwin: {
    arm64: {
      asset: "claurst-macos-aarch64.tar.gz",
      binary: "claurst-macos-aarch64"
    },
    x64: {
      asset: "claurst-macos-x86_64.tar.gz",
      binary: "claurst-macos-x86_64"
    }
  },
  linux: {
    arm64: {
      asset: "claurst-linux-aarch64.tar.gz",
      binary: "claurst-linux-aarch64"
    },
    x64: {
      asset: "claurst-linux-x86_64.tar.gz",
      binary: "claurst-linux-x86_64"
    }
  },
  win32: {
    x64: {
      asset: "claurst-windows-x86_64.zip",
      binary: "claurst-windows-x86_64.exe"
    }
  }
};

function getTarget() {
  const platformTargets = TARGETS[process.platform];
  if (!platformTargets) {
    throw new Error(`Unsupported platform: ${process.platform}`);
  }

  const target = platformTargets[process.arch];
  if (!target) {
    throw new Error(`Unsupported architecture for ${process.platform}: ${process.arch}`);
  }

  return target;
}

function download(url, destination) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        download(response.headers.location, destination).then(resolve, reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Download failed with status ${response.statusCode} for ${url}`));
        response.resume();
        return;
      }

      const file = fs.createWriteStream(destination);
      response.pipe(file);
      file.on("finish", () => file.close(resolve));
      file.on("error", reject);
    });

    request.on("error", reject);
  });
}

function extract(archivePath, extractDir) {
  if (archivePath.endsWith(".tar.gz")) {
    execFileSync("tar", ["-xzf", archivePath, "-C", extractDir], { stdio: "inherit" });
    return;
  }

  if (archivePath.endsWith(".zip")) {
    execFileSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        `Expand-Archive -Path '${archivePath}' -DestinationPath '${extractDir}' -Force`
      ],
      { stdio: "inherit" }
    );
    return;
  }

  throw new Error(`Unsupported archive format: ${archivePath}`);
}

async function main() {
  const { asset, binary } = getTarget();
  const version = packageJson.version;
  const url = `https://github.com/cgasgarth/claurst/releases/download/v${version}/${asset}`;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "claurst-install-"));
  const archivePath = path.join(tempDir, asset);
  const runtimeDir = path.join(__dirname, "..", "runtime");
  const destinationName = process.platform === "win32" ? "claurst.exe" : "claurst";
  const destinationPath = path.join(runtimeDir, destinationName);

  fs.rmSync(runtimeDir, { recursive: true, force: true });
  fs.mkdirSync(runtimeDir, { recursive: true });

  try {
    console.log(`Downloading ${url}`);
    await download(url, archivePath);
    extract(archivePath, tempDir);

    const binaryPath = path.join(tempDir, binary);
    if (!fs.existsSync(binaryPath)) {
      throw new Error(`Extracted binary not found: ${binaryPath}`);
    }

    fs.copyFileSync(binaryPath, destinationPath);
    if (process.platform !== "win32") {
      fs.chmodSync(destinationPath, 0o755);
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`Failed to install Claurst: ${error.message}`);
  process.exit(1);
});
