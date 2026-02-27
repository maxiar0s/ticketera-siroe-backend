const RAG_AGENT_URL = (process.env.RAG_AGENT_URL || "").trim();
const RAG_AGENT_API_KEY = process.env.RAG_AGENT_API_KEY || "";
const RAG_AGENT_TIMEOUT_MS = Number(process.env.RAG_AGENT_TIMEOUT_MS || 15000);
const DEFAULT_RAG_AGENT_URLS = [
  "http://localhost:8000/agent/process",
  "http://rag-ticketera-ai:8000/agent/process",
];

const getHeaders = () => {
  const headers = {
    "Content-Type": "application/json",
  };

  if (RAG_AGENT_API_KEY) {
    headers["X-API-KEY"] = RAG_AGENT_API_KEY;
  }

  return headers;
};

const safeParseJson = async (response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const buildCandidateUrls = () => {
  const urls = RAG_AGENT_URL ? [RAG_AGENT_URL, ...DEFAULT_RAG_AGENT_URLS] : DEFAULT_RAG_AGENT_URLS;
  const seen = new Set();
  return urls.filter((url) => {
    if (!url || seen.has(url)) {
      return false;
    }
    seen.add(url);
    return true;
  });
};

export const consultarAgenteRag = async ({ mensaje, userId, conversationId }) => {
  const payload = {
    subject: "Consulta desde Ticketera",
    content: mensaje,
    user_id: userId || null,
    conversation_id: conversationId || null,
  };
  const candidateUrls = buildCandidateUrls();
  const errors = [];

  for (const url of candidateUrls) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(RAG_AGENT_TIMEOUT_MS),
      });

      const body = await safeParseJson(response);

      if (!response.ok) {
        const upstreamError =
          body?.detail ||
          body?.error ||
          `El servicio RAG respondió con estado ${response.status}`;

        return {
          ok: false,
          status: 502,
          error: `RAG devolvió error (${response.status}) en ${url}: ${upstreamError}`,
        };
      }

      return {
        ok: true,
        solution: typeof body?.solution === "string" ? body.solution : "",
        sources: Array.isArray(body?.sources) ? body.sources : [],
      };
    } catch (error) {
      const timeoutError =
        error?.name === "TimeoutError" || error?.name === "AbortError";
      errors.push({
        url,
        timeout: timeoutError,
        detail: timeoutError ? "timeout" : error?.message || "error de conexion",
      });
    }
  }

  const timeoutDetected = errors.some((item) => item.timeout);
  const detalleErrores = errors
    .map((item) => `${item.url} (${item.detail})`)
    .join("; ");

  if (timeoutDetected) {
    return {
      ok: false,
      status: 504,
      error: `Tiempo de espera agotado al consultar el servicio RAG. Intentos: ${detalleErrores}`,
    };
  }

  return {
    ok: false,
    status: 502,
    error: `No fue posible consultar el servicio RAG. Intentos: ${detalleErrores}`,
  };
};
