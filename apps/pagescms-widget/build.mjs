import * as esbuild from "esbuild";
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, "dist");
const distOutfile = path.join(distDir, "pagescms-widget.js");
const publicOutfile = path.resolve(__dirname, "../../public/pagescms-widget.js");
const watch = process.argv.includes("--watch");

const buildOptions = {
  entryPoints: [path.resolve(__dirname, "src/index.ts")],
  bundle: true,
  outfile: distOutfile,
  format: "iife",
  target: ["es2019"],
  platform: "browser",
  legalComments: "none",
  logLevel: "info",
};

async function writeOutputs() {
  await copyFile(distOutfile, publicOutfile);
}

async function build() {
  await mkdir(distDir, { recursive: true });
  await mkdir(path.dirname(publicOutfile), { recursive: true });

  if (watch) {
    const context = await esbuild.context({
      ...buildOptions,
      plugins: [
        {
          name: "copy-to-public",
          setup(build) {
            build.onEnd(async (result) => {
              if (result.errors.length === 0) {
                await writeOutputs();
                console.log(`Copied to ${publicOutfile}`);
              }
            });
          },
        },
      ],
    });
    await context.watch();
    console.log(`Watching ${distOutfile}`);
    return;
  }

  await esbuild.build(buildOptions);
  await writeOutputs();
  console.log(`Built ${distOutfile}`);
  console.log(`Copied to ${publicOutfile}`);
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
