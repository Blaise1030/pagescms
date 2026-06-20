import { NextResponse } from "next/server";
import { FORK_REPOSITORY } from "@/lib/brand";

const PACKAGE_JSON_URL = `https://raw.githubusercontent.com/${FORK_REPOSITORY}/main/package.json`;

export async function GET() {
  try {
    const response = await fetch(PACKAGE_JSON_URL, {
      headers: {
        Accept: "application/json",
      },
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      return NextResponse.json(
        { status: "error", message: "Unable to fetch latest app version." },
        { status: 502 },
      );
    }

    const pkg = (await response.json()) as { version?: string };

    return NextResponse.json({
      status: "success",
      latest: pkg.version ?? null,
      repository: FORK_REPOSITORY,
      source: "package.json",
    });
  } catch {
    return NextResponse.json(
      { status: "error", message: "Unable to fetch latest app version." },
      { status: 500 },
    );
  }
}
