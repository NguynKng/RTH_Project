import { useEffect, useState } from "react";
import { RouterProvider } from "react-router";
import { LoaderCircle } from "./components/icons";
import { configured } from "./api/client";
import { bootstrapData } from "./data/bootstrap";
import { useBoardStore } from "./data/store";
import { router } from "./routes/router";
import { Icon, StatePanel } from "./components/ui";
export default function App() {
  const status = useBoardStore((state) => state.bootstrap),
    error = useBoardStore((state) => state.bootstrapError);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!configured()) return;
    const controller = new AbortController();
    void bootstrapData(controller.signal);
    return () => controller.abort();
  }, [attempt]);
  if (!configured())
    return (
      <main className="app-gate">
        <a className="wordmark" href="/">
          Bluebay
        </a>
        <StatePanel
          title="Connect your helpdesk"
          description="Add HELPDESK_URL and HELPDESK_TOKEN to .env, then restart the development server."
        >
          <code>cp .env.example .env</code>
        </StatePanel>
      </main>
    );
  if (status === "error")
    return (
      <main className="app-gate">
        <span className="wordmark">Bluebay</span>
        <StatePanel title="Can't reach the helpdesk" description={error} error>
          <button
            className="button button-outline"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Try again
          </button>
        </StatePanel>
      </main>
    );
  if (status !== "ready")
    return (
      <main className="app-gate">
        <span className="wordmark">Bluebay</span>
        <div className="bootstrap-loading" role="status">
          <Icon as={LoaderCircle} size={24} className="spin" />
          <p>Loading sites and staff…</p>
        </div>
      </main>
    );
  return <RouterProvider router={router} />;
}
