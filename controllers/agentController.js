import { consultarAgenteRag } from "../services/ragAgentService.js";

const OPEN_CREATE_TICKET_MARKER = "[[ACTION_OPEN_CREATE_TICKET]]";

const parseAgentActions = (solution) => {
  const raw = typeof solution === "string" ? solution : "";
  const actions = [];

  let respuesta = raw;
  if (raw.includes(OPEN_CREATE_TICKET_MARKER)) {
    actions.push("open_create_ticket");
    respuesta = raw.split(OPEN_CREATE_TICKET_MARKER).join(" ").trim();
  }

  return {
    respuesta,
    acciones: actions,
  };
};

export const consultarAgente = async (req, res) => {
  try {
    const mensaje =
      typeof req.body?.mensaje === "string" ? req.body.mensaje.trim() : "";
    const conversationId =
      typeof req.body?.conversationId === "string"
        ? req.body.conversationId.trim()
        : "";

    if (!mensaje) {
      return res.status(400).json({
        error: "El campo mensaje es obligatorio.",
      });
    }

    const result = await consultarAgenteRag({
      mensaje,
      userId: req.usuario?.id,
      conversationId,
    });

    if (!result.ok) {
      console.error("Error consultando servicio RAG:", {
        status: result.status,
        error: result.error,
      });
      return res.status(result.status).json({ error: result.error });
    }

    const parsed = parseAgentActions(result.solution);
    const hideSources = parsed.acciones.length > 0;

    return res.json({
      respuesta: parsed.respuesta,
      fuentes: hideSources ? [] : result.sources,
      acciones: parsed.acciones,
    });
  } catch (error) {
    console.error("Error inesperado en consultarAgente:", error);
    return res.status(500).json({
      error: "Error interno al consultar el agente.",
    });
  }
};

export default {
  consultarAgente,
};
