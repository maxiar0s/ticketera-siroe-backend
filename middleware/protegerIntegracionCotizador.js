import crypto from "node:crypto";

const getSecretBuffer = (value) => Buffer.from(`${value || ""}`);

const protegerIntegracionCotizador = (req, res, next) => {
  const expectedSecret = process.env.COTIZADOR_WEBHOOK_SECRET || "";
  if (!expectedSecret) {
    return res.status(500).json({
      error: "COTIZADOR_WEBHOOK_SECRET no esta configurado.",
    });
  }

  const providedSecret = req.headers["x-webhook-secret"];
  if (typeof providedSecret !== "string" || !providedSecret.trim()) {
    return res.status(401).json({
      error: "Falta cabecera X-Webhook-Secret.",
    });
  }

  const expectedBuffer = getSecretBuffer(expectedSecret);
  const providedBuffer = getSecretBuffer(providedSecret.trim());

  if (
    expectedBuffer.length !== providedBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, providedBuffer)
  ) {
    return res.status(401).json({
      error: "Webhook secret invalido.",
    });
  }

  next();
};

export default protegerIntegracionCotizador;
