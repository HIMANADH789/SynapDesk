const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

esbuild
  .build({
    entryPoints: ["src/index.ts"],
    bundle: true,
    minify: true,
    format: "iife",
    target: ["es2020"],
    outfile: "dist/chatbot-widget.js",
  })
  .then(() => {
    // Copy to frontend public folder if it exists
    const frontendPath = path.join(
      __dirname,
      "..",
      "frontend",
      "public",
      "widget"
    );
    if (fs.existsSync(path.join(__dirname, "..", "frontend", "public"))) {
      fs.mkdirSync(frontendPath, { recursive: true });
      fs.copyFileSync(
        "dist/chatbot-widget.js",
        path.join(frontendPath, "chatbot-widget.js")
      );
      console.log("Widget copied to frontend/public/widget/");
    }
    console.log("Widget built successfully!");
  })
  .catch(() => process.exit(1));
