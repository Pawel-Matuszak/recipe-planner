"use client";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useState } from "react";
import { createQueryClient, persistOptions, resumeWrites } from "../data/queryClient";
import { App } from "./App";

export function Root() {
  const [queryClient] = useState(createQueryClient);
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions} onSuccess={() => resumeWrites(queryClient)}>
      <App />
    </PersistQueryClientProvider>
  );
}
