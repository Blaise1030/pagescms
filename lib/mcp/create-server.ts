import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { deleteContentEntry, writeContentEntry } from "@/lib/content-write";
import {
  getEntry,
  getEntrySchema,
  listCollections,
  listEntries,
} from "@/lib/content-service";
import { getDoc, searchDocs } from "@/lib/docs-index";
import type { McpAuth } from "@/lib/mcp/repo-context";
import { resolveMcpReadContext, resolveMcpRepoContext } from "@/lib/mcp/repo-context";

const repoSchema = z.object({
  owner: z.string().describe("GitHub repository owner"),
  repo: z.string().describe("GitHub repository name"),
  branch: z.string().describe("Git branch name"),
});

const jsonResult = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
});

const createPagesCmsMcpServer = (auth: McpAuth) => {
  const server = new McpServer({
    name: "pagescms",
    version: "1.0.0",
  });

  server.registerTool(
    "list_collections",
    {
      description: "List content collections and files defined in .pages.yml",
      inputSchema: repoSchema,
    },
    async (args) => {
      const ctx = await resolveMcpRepoContext(auth, args, "read");
      return jsonResult(listCollections(ctx));
    },
  );

  server.registerTool(
    "get_entry_schema",
    {
      description: "Get JSON Schema and field definitions for a collection or file entry",
      inputSchema: repoSchema.extend({
        name: z.string().describe("Collection or file name from .pages.yml"),
      }),
    },
    async (args) => {
      const ctx = await resolveMcpRepoContext(auth, args, "read");
      return jsonResult(getEntrySchema(ctx, args.name));
    },
  );

  server.registerTool(
    "list_entries",
    {
      description: "List entries in a collection directory",
      inputSchema: repoSchema.extend({
        name: z.string(),
        path: z.string().describe("Collection path from the schema (e.g. content/posts)"),
        query: z.string().optional(),
        searchFields: z.array(z.string()).optional(),
      }),
    },
    async (args) => {
      const ctx = await resolveMcpRepoContext(auth, args, "read");
      const result = await listEntries(ctx, args.name, {
        path: args.path,
        query: args.query,
        searchFields: args.searchFields,
        type: args.query ? "search" : undefined,
      });
      return jsonResult(result);
    },
  );

  server.registerTool(
    "get_entry",
    {
      description: "Fetch and parse a single content entry",
      inputSchema: repoSchema.extend({
        name: z.string(),
        path: z.string().describe("File path within the repository"),
      }),
    },
    async (args) => {
      const ctx = await resolveMcpReadContext(auth, args, "read");
      return jsonResult(await getEntry(ctx, args.name, args.path));
    },
  );

  server.registerTool(
    "write_entry",
    {
      description:
        "Create or update a content entry. Default mode is propose (opens a PR). Use mode commit for direct commits.",
      inputSchema: repoSchema.extend({
        name: z.string(),
        path: z.string(),
        content: z.record(z.string(), z.unknown()),
        sha: z.string().optional(),
        onConflict: z.enum(["error", "rename"]).optional(),
        mode: z.enum(["commit", "propose"]).optional(),
      }),
    },
    async (args) => {
      const ctx = await resolveMcpRepoContext(auth, args, "write");
      const result = await writeContentEntry(ctx, {
        name: args.name,
        path: args.path,
        content: args.content,
        sha: args.sha,
        onConflict: args.onConflict,
        mode: args.mode,
      });
      return jsonResult(result);
    },
  );

  server.registerTool(
    "delete_entry",
    {
      description: "Delete a content entry. Default mode is propose (opens a PR).",
      inputSchema: repoSchema.extend({
        name: z.string(),
        path: z.string(),
        sha: z.string(),
        mode: z.enum(["commit", "propose"]).optional(),
      }),
    },
    async (args) => {
      const ctx = await resolveMcpRepoContext(auth, args, "write");
      const result = await deleteContentEntry(ctx, {
        name: args.name,
        path: args.path,
        sha: args.sha,
        mode: args.mode,
      });
      return jsonResult(result);
    },
  );

  server.registerTool(
    "search_docs",
    {
      description: "Search PagesCMS product documentation for configuration and usage guidance",
      inputSchema: z.object({
        query: z.string(),
        limit: z.number().int().min(1).max(10).optional(),
      }),
    },
    async (args) => jsonResult(searchDocs(args.query, args.limit ?? 5)),
  );

  server.registerTool(
    "get_doc",
    {
      description: "Fetch a full documentation page by slug (e.g. configuration/content)",
      inputSchema: z.object({
        slug: z.string(),
      }),
    },
    async (args) => {
      const doc = getDoc(args.slug);
      if (!doc) {
        return {
          content: [{ type: "text" as const, text: `Documentation page not found: ${args.slug}` }],
          isError: true,
        };
      }
      return jsonResult(doc);
    },
  );

  return server;
};

export { createPagesCmsMcpServer };
