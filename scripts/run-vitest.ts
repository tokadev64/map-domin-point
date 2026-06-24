const packageJsonUrl = import.meta.resolve("npm:vitest/package.json");
const cliUrl = new URL("./vitest.mjs", packageJsonUrl);

await import(cliUrl.href);
