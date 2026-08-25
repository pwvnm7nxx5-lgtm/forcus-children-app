const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const styles = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const index = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("grouped ruby overlays replace only the ruby-cell perimeter", () => {
  const groupedBlock = styles.match(/\.grouped-ruby-cell\s*\{([\s\S]*?)\n\}/u)?.[1] || "";
  assert.match(groupedBlock, /box-sizing:\s*border-box/u);
  assert.match(groupedBlock, /border:\s*1\.2px\s+solid\s+var\(--line\)/u);
  assert.match(groupedBlock, /background:\s*#fff/u);
  assert.doesNotMatch(groupedBlock, /border:\s*0/u);
  assert.doesNotMatch(groupedBlock, /rgba\(255,\s*255,\s*255/u);
  assert.doesNotMatch(styles, /repeating-linear-gradient/u);
  assert.doesNotMatch(app, /gridColumn\s*=\s*`\$\{col \* 2 \+ 2\} \/ span/u);
});

test("all reading assets share the current cache key", () => {
  const versions = [...index.matchAll(/(?:href|src)="([^"]*)\?v=(furigana-v\d+)"/gu)]
    .filter((match) => !match[1].includes("vendor/"))
    .map((match) => match[2]);
  assert.ok(versions.length > 1);
  assert.equal(new Set(versions).size, 1);
  assert.equal(versions[0], "furigana-v12");
});
