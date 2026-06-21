import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PreviewPanel } from "./preview-panel";

const url = "https://mysite.com/preview/products";

describe("PreviewPanel", () => {
  it("renders iframe with the given previewUrl", () => {
    render(<PreviewPanel previewUrl={url} formValues={{}} iframeRef={{ current: null }} />);
    expect(screen.getByTitle("preview")).toHaveAttribute("src", url);
  });

  it("renders a Refresh button", () => {
    render(<PreviewPanel previewUrl={url} formValues={{}} iframeRef={{ current: null }} />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("renders an Open in new tab link", () => {
    render(<PreviewPanel previewUrl={url} formValues={{}} iframeRef={{ current: null }} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", url);
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("Refresh button reloads the iframe by resetting src", async () => {
    const iframeEl = document.createElement("iframe");
    const iframeRef = { current: iframeEl };
    render(<PreviewPanel previewUrl={url} formValues={{}} iframeRef={iframeRef} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button"));
    expect(iframeRef.current.src).toContain(url);
  });
});
