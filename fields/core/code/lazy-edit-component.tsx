import dynamic from "next/dynamic";

export const EditComponent = dynamic(
  () => import("./edit-component").then((m) => ({ default: m.EditComponent })),
  {
    ssr: false,
    loading: () => (
      <div className="h-32 w-full animate-pulse rounded-md bg-muted" />
    ),
  }
);
