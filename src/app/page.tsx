"use client";
import dynamic from "next/dynamic";

// The app lives in localStorage and the query cache, so it only renders in the browser.
const Root = dynamic(() => import("../components/Root").then(m => m.Root), { ssr: false });

export default function Page() {
  return <Root />;
}
