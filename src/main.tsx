import "./index.css";
import { PersistQueryClientProvider } from "@tanstack/preact-query-persist-client";
import { render } from "preact";
import { registerSW } from "virtual:pwa-register";
import { App } from "./components/App";
import { createQueryClient, persistOptions, resumeWrites } from "./data/queryClient";

registerSW({ immediate: true });

const queryClient = createQueryClient();

render(
  <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions} onSuccess={() => resumeWrites(queryClient)}>
    <App />
  </PersistQueryClientProvider>,
  document.getElementById("app")!,
);
