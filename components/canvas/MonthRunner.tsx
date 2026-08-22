"use client";

import dynamic from "next/dynamic";

// The scene touches the DOM on mount and has nothing meaningful to prerender,
// so it never runs on the server.
const MonthRunnerScene = dynamic(
  () =>
    import("@/components/canvas/MonthRunnerScene").then(
      (mod) => mod.MonthRunnerScene,
    ),
  { ssr: false },
);

export function MonthRunner() {
  return <MonthRunnerScene />;
}
