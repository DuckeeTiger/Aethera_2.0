const { spawn } = require("child_process");

console.log("[debug] Starting Eleventy build...");

const heartbeat = setInterval(() => {
  const mem = process.memoryUsage();
  console.log(
    `[debug] heartbeat rss=${Math.round(mem.rss / 1024 / 1024)}MB heapUsed=${Math.round(mem.heapUsed / 1024 / 1024)}MB`
  );
}, 30000);

const child = spawn("npx", ["eleventy"], {
  shell: true,
  stdio: "inherit",
  env: {
    ...process.env,
    ELEVENTY_ENV: "prod",
    NODE_OPTIONS: "--trace-uncaught --trace-warnings --max-old-space-size=8192",
    USE_FULL_RESOLUTION_IMAGES: "true",
  },
});

child.on("close", (code, signal) => {
  clearInterval(heartbeat);
  console.log(`[debug] Eleventy closed. code=${code} signal=${signal}`);
  process.exit(code ?? 1);
});

child.on("error", (err) => {
  clearInterval(heartbeat);
  console.error("[debug] Failed to start Eleventy:", err);
  process.exit(1);
});
