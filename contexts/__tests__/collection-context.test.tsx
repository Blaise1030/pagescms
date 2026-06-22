import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

vi.mock("@/app/(main)/[owner]/[repo]/[branch]/_contexts/config-context", () => ({
  useConfig: vi.fn(() => ({
    config: {
      object: {
        content: [
          { name: "posts", type: "collection", fields: [{ name: "title", type: "string" }] },
        ],
      },
    },
  })),
}));

import { CollectionProvider, useCollection } from "@/app/(main)/[owner]/[repo]/[branch]/_contexts/collection-context";

function TestConsumer() {
  const { schema, operations } = useCollection();
  return (
    <div>
      <span data-testid="name">{schema?.name}</span>
      <span data-testid="can-create">{String(operations.create)}</span>
    </div>
  );
}

describe("CollectionContext", () => {
  it("provides schema derived from config + name", () => {
    render(
      <CollectionProvider name="posts">
        <TestConsumer />
      </CollectionProvider>
    );
    expect(screen.getByTestId("name").textContent).toBe("posts");
  });

  it("provides operations derived from schema", () => {
    render(
      <CollectionProvider name="posts">
        <TestConsumer />
      </CollectionProvider>
    );
    expect(screen.getByTestId("can-create").textContent).toBe("true");
  });

  it("throws when used outside the provider", () => {
    const err = console.error;
    console.error = vi.fn();
    expect(() => render(<TestConsumer />)).toThrow();
    console.error = err;
  });
});
