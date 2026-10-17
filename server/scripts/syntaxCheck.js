// Dependency-free syntax check of every server source file.
import { readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { spawnSync } from "node:child_process";

const skip = new Set(["node_modules"]);
let failed = false;

const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    if (skip.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (extname(p) === ".js") {
      const r = spawnSync(process.execPath, ["--check", p], { encoding: "utf8" });
      if (r.status !== 0) {
        failed = true;
        console.error(`Syntax error in ${p}\n${r.stderr}`);
      }
    }
  }
};

walk(process.cwd());
process.exit(failed ? 1 : 0);
