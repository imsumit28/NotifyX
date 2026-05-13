#!/usr/bin/env node

const { execFileSync } = require("node:child_process");

const modeArg = process.argv.find((arg) => arg.startsWith("--mode="));
const mode = modeArg ? modeArg.split("=")[1] : "staged";

const blockedFilePatterns = [
  /^\.env$/,
  /^\.env\..+/,
  /(^|\/)id_rsa$/,
  /(^|\/)id_dsa$/,
  /(^|\/)id_ed25519$/,
  /(^|\/)credentials(\.[^.]+)?\.json$/i,
  /(^|\/)secrets?(\.|\/|$)/i,
  /\.(pem|p12|pfx|key)$/i,
];

const allowedFilePatterns = [/\.env\.example$/i, /\.env\.sample$/i, /\.env\.template$/i];

const secretPatterns = [
  { name: "AWS access key", regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "GitHub token", regex: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { name: "GitHub fine-grained PAT", regex: /\bgithub_pat_[A-Za-z0-9_]{82,}\b/ },
  { name: "Google API key", regex: /\bAIza[0-9A-Za-z\-_]{35}\b/ },
  { name: "Slack token", regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: "JWT-like token", regex: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
  {
    name: "Potential hardcoded secret",
    regex: /\b(api[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token|secret|token)\b\s*[:=]\s*["'][^"'\s]{8,}["']/i,
  },
  {
    name: "Credentialed connection string",
    regex: /\b(mongodb(\+srv)?|postgres(ql)?|mysql|redis):\/\/[^:\s\/]+:[^@\s]+@/i,
  },
  { name: "Private key block", regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
];

function runGit(args, fallback = "") {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch {
    return fallback;
  }
}

function isAllowedFile(filePath) {
  return allowedFilePatterns.some((pattern) => pattern.test(filePath));
}

function isBlockedFile(filePath) {
  if (isAllowedFile(filePath)) return false;
  return blockedFilePatterns.some((pattern) => pattern.test(filePath));
}

function readStagedFile(filePath) {
  return runGit(["show", `:${filePath}`], "");
}

function readHeadFile(filePath) {
  return runGit(["show", `HEAD:${filePath}`], "");
}

function hasBinaryContent(content) {
  return content.includes("\u0000");
}

function scanContent(filePath, content, findings) {
  if (!content || hasBinaryContent(content)) return;

  for (const pattern of secretPatterns) {
    if (pattern.regex.test(content)) {
      findings.push(`${filePath} (${pattern.name})`);
    }
  }
}

function unique(items) {
  return Array.from(new Set(items));
}

function getStagedFiles() {
  const output = runGit(["diff", "--cached", "--name-only", "--diff-filter=ACMR"], "");
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function getRangeFiles() {
  const upstream = runGit(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"], "").trim();
  if (upstream) {
    const changed = runGit(["diff", "--name-only", "--diff-filter=ACMR", `${upstream}...HEAD`], "");
    return changed
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  const changed = runGit(["show", "--name-only", "--diff-filter=ACMR", "--pretty=format:", "HEAD"], "");
  return changed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function collectFindings(files, readFile) {
  const findings = [];
  for (const file of files) {
    if (isBlockedFile(file)) {
      findings.push(`${file} (blocked sensitive filename)`);
      continue;
    }

    scanContent(file, readFile(file), findings);
  }
  return unique(findings);
}

function printFailure(findings, modeName) {
  console.error(`\nSecret scan failed during ${modeName}.`);
  console.error("Remove secrets/keys before committing or pushing:\n");
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  console.error(
    "\nIf this is a false positive, replace sensitive-looking values with placeholders (for example, '<YOUR_API_KEY>')."
  );
}

let findings = [];
if (mode === "staged") {
  findings = collectFindings(getStagedFiles(), readStagedFile);
} else if (mode === "range") {
  findings = collectFindings(getRangeFiles(), readHeadFile);
} else {
  console.error(`Unknown mode "${mode}". Use --mode=staged or --mode=range.`);
  process.exit(2);
}

if (findings.length > 0) {
  printFailure(findings, mode);
  process.exit(1);
}

console.log(`Secret scan passed (${mode}).`);
