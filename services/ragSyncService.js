const RAG_SYNC_WEBHOOK_URL = process.env.RAG_SYNC_WEBHOOK_URL || "";
const RAG_SYNC_WEBHOOK_SECRET = process.env.RAG_SYNC_WEBHOOK_SECRET || "";
const RAG_SYNC_ENABLED = (process.env.RAG_SYNC_ENABLED || "true") === "true";
const RAG_SYNC_TIMEOUT_MS = Number(process.env.RAG_SYNC_TIMEOUT_MS || 5000);

const buildPayload = ({ action, projectId, triggeredBy }) => ({
  action,
  project_id: projectId ?? null,
  triggered_by: triggeredBy || "ss-ticketera-back",
});

const requestOptions = (payload) => {
  const headers = {
    "Content-Type": "application/json",
  };

  if (RAG_SYNC_WEBHOOK_SECRET) {
    headers["X-WEBHOOK-SECRET"] = RAG_SYNC_WEBHOOK_SECRET;
  }

  return {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(RAG_SYNC_TIMEOUT_MS),
  };
};

export const dispatchBibliotecaSync = ({ action, projectId, triggeredBy }) => {
  if (!RAG_SYNC_ENABLED) {
    return;
  }

  if (!RAG_SYNC_WEBHOOK_URL) {
    console.warn("[RAG Sync] RAG_SYNC_WEBHOOK_URL no configurado; sync omitido");
    return;
  }

  const payload = buildPayload({ action, projectId, triggeredBy });

  setImmediate(async () => {
    try {
      const response = await fetch(
        RAG_SYNC_WEBHOOK_URL,
        requestOptions(payload),
      );
      const bodyText = await response.text();

      if (!response.ok) {
        console.error(
          `[RAG Sync] Error webhook ${response.status}: ${bodyText}`,
        );
        return;
      }

      console.log(
        `[RAG Sync] Webhook disparado action=${action} projectId=${projectId ?? "-"}`,
      );
    } catch (error) {
      console.error("[RAG Sync] Fallo disparando webhook:", error.message);
    }
  });
};
