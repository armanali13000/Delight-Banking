const fs = require("fs");
const path = require("path");

if (process.env.VERCEL) {
  process.exit(0);
}

const docsDir = path.join(__dirname, "..", "docs");
fs.copyFileSync(path.join(docsDir, "index.html"), path.join(docsDir, "404.html"));
