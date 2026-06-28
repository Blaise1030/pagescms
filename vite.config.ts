import { cloudflare } from "@cloudflare/vite-plugin";
import vinext from "vinext";
import { defineConfig } from "vite";

export default defineConfig({
  environments: {
    rsc: {
      build: {
        rolldownOptions: {
          external: ["react-resizable-panels", "@modelcontextprotocol/sdk"],
        },
      },
    },
  },
  plugins: [
    vinext(),
    cloudflare({
      viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
    }),
  ],
  define: {
    __dirname: JSON.stringify("/"),
  },
});
