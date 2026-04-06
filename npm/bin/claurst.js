#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const exe = process.platform === "win32" ? "claurst.exe" : "claurst";
const binaryPath = path.join(__dirname, "..", "runtime", exe);

if (!fs.existsSync(binaryPath)) {
  console.error("Claurst binary is missing. Reinstall @cgasgarth/claurst.");
  process.exit(1);
}

const child = spawn(binaryPath, process.argv.slice(2), {
  stdio: "inherit"
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

child.on("error", (error) => {
  console.error(`Failed to launch Claurst: ${error.message}`);
  process.exit(1);
});
