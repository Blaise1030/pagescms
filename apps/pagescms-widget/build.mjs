import * as esbuild from "esbuild";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicOutfile = path.resolve(__dirname, "../../public/pagescms-widget.js");
const watch = process.argv.includes("--watch");

const buildOptions = {
  entryPoints: [path.resolve(__dirname, "src/index.ts")],
  bundle: true,
  outfile: publicOutfile,
  format: "iife",
  target: ["es2019"],
  platform: "browser",
  legalComments: "none",
  logLevel: "info",
};

async function build() {
  await mkdir(path.dirname(publicOutfile), { recursive: true });

  if (watch) {
    const context = await esbuild.context({
      ...buildOptions,
      plugins: [
        {
          name: "widget-watch",
          setup(build) {
            build.onEnd((result) => {
              if (result.errors.length === 0) {
                console.log(`Built ${publicOutfile}`);
              }
            });
          },
        },
      ],
    });
    await context.watch();
    console.log(`Watching ${publicOutfile}`);
    return;
  }

  await esbuild.build(buildOptions);
  console.log(`Built ${publicOutfile}`);
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
