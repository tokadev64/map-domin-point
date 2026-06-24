const packageJsonUrl = import.meta.resolve(
  "npm:@voidzero-dev/vite-plus-core/package.json",
);
const cliUrl = new URL("./dist/vite/node/cli.js", packageJsonUrl);

await import(cliUrl.href);
