import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { htmlToText } from "html-to-text";
import { randomUUID } from "crypto";
import path from "path";
import nodemailer from "nodemailer";
import { Op } from "sequelize";

import bucket from "../../config/gcs.js";
import db from "../../config/db.js";
import { emailTicketConfig } from "../../config/emailTicketConfig.js";
import {
  ActividadTicketModel,
  TicketModel,
  CasaMatrizModel,
  CuentaModel,
} from "../../models/index.js";

const ESTADO_TICKET_INGRESADO = "Nuevo";
const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "hotmail.com",
  "hotmail.cl",
  "hotmail.es",
  "outlook.com",
  "outlook.cl",
  "outlook.es",
  "live.com",
  "live.cl",
]);
const ALLOWLIST_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const LINK_LABEL = "[LINK]";
const THREAD_SUBJECT_PREFIX_REGEX = /^(\s*(re|rv|fw|fwd|aw)\s*:\s*)+/i;
const THREAD_TICKET_TAG_REGEX = /\[\s*ticket\s*#?\s*(\d+)\s*\]/i;
const THREAD_MATCH_WINDOW_DAYS = 21;

const normalizeEmail = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const normalizeThreadSubject = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/\[\s*ticket\s*#?\s*\d+\s*\]/gi, " ")
    .replace(THREAD_SUBJECT_PREFIX_REGEX, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
};

const extractTicketIdFromSubject = (subject) => {
  if (typeof subject !== "string") {
    return null;
  }

  const match = subject.match(THREAD_TICKET_TAG_REGEX);
  if (!match?.[1]) {
    return null;
  }

  const ticketId = Number.parseInt(match[1], 10);
  return Number.isInteger(ticketId) ? ticketId : null;
};

const toDateOnly = (date, timezone = "UTC") => {
  const reference = date instanceof Date ? date : new Date(date);
  // eslint-disable-next-line no-restricted-globals
  if (!(reference instanceof Date) || Number.isNaN(reference.getTime())) {
    const now = new Date();
    return now.toISOString().slice(0, 10);
  }

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  // en-CA returns YYYY-MM-DD by default
  return formatter.format(reference);
};

const ensureArray = (value, fallback = []) => {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === "string" && value.length > 0) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  return Array.isArray(fallback) ? fallback : [];
};

const cleanBody = (parsed) => {
  if (!parsed) {
    return "";
  }
  if (parsed.text && parsed.text.trim()) {
    return parsed.text.trim();
  }
  if (parsed.html && parsed.html.trim()) {
    return htmlToText(parsed.html, {
      wordwrap: 120,
      selectors: [{ selector: "img", format: "skip" }],
    }).trim();
  }
  return "";
};

const enhanceBodyText = (text) => {
  if (!text) {
    return "";
  }

  let sanitized = `${text}`;

  sanitized = sanitized
    .replace(/\[cid:[^\]]+\]/gi, "")
    .replace(/cid:[^\s]+/gi, "");

  sanitized = sanitized.replace(
    /\[(https?:\/\/[^\]\s]+)\]/gi,
    (_match, url) => {
      return `\n${LINK_LABEL} ${url}\n`;
    }
  );

  sanitized = sanitized.replace(/https?:\/\/\S+/gi, (url, offset, full) => {
    const prefixStart = Math.max(0, offset - (LINK_LABEL.length + 2));
    const prefix = full.slice(prefixStart, offset);
    if (prefix.includes(LINK_LABEL)) {
      return url;
    }
    return `\n${LINK_LABEL} ${url}\n`;
  });

  sanitized = sanitized.replace(/\n{3,}/g, "\n\n");

  return sanitized.trim();
};

const toValidDate = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  if (!value) {
    return new Date();
  }
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }
  return new Date();
};

const primaryAddress = (addressObject) => {
  if (!addressObject) {
    return null;
  }
  const list = Array.isArray(addressObject.value) ? addressObject.value : [];
  if (!list.length) {
    return null;
  }
  const first = list[0];
  if (first && typeof first.address === "string") {
    return first.address.trim();
  }
  return null;
};

const getSenderName = (addressObject) => {
  if (!addressObject) {
    return null;
  }
  const list = Array.isArray(addressObject.value) ? addressObject.value : [];
  if (!list.length) {
    return null;
  }
  const first = list[0];
  if (first && typeof first.name === "string" && first.name.trim().length) {
    return first.name.trim();
  }
  return null;
};

const uploadAttachmentToGcs = async (attachment) => {
  if (!attachment) {
    return null;
  }

  const originalName =
    attachment.filename && attachment.filename.trim().length
      ? attachment.filename.trim()
      : `adjunto-${randomUUID()}`;
  const extension = path.extname(originalName);
  const gcsFileName = `${randomUUID()}${extension}`;
  const file = bucket.file(gcsFileName);
  const contentType =
    typeof attachment.contentType === "string" && attachment.contentType.length
      ? attachment.contentType
      : "application/octet-stream";

  // mailparser provides attachment.content as a Buffer by default
  const content =
    attachment.content && Buffer.isBuffer(attachment.content)
      ? attachment.content
      : Buffer.from([]);

  if (!content.length) {
    return null;
  }

  await file.save(content, {
    resumable: false,
    metadata: {
      contentType,
      originalName,
    },
  });

  return gcsFileName;
};

export class EmailTicketProcessor {
  constructor(config = emailTicketConfig) {
    this.config = config;
    this.connected = false;
    this.smtpTransporter = null;
    this.allowedEmails = new Set(
      ensureArray(config.allowedSenderEmails)
        .map(normalizeEmail)
        .filter((email) => email.length > 0)
    );
    this.allowedDomains = new Set(
      ensureArray(config.allowedSenderDomains)
        .map((domain) =>
          domain && typeof domain === "string"
            ? domain.replace(/^@/, "").trim().toLowerCase()
            : null
        )
        .filter((domain) => domain && domain.length > 0)
    );
    this.noReplyEmails = new Set(
      ensureArray(config.noReplyEmails)
        .map(normalizeEmail)
        .filter((email) => email.length > 0)
    );
    this.noReplyDomains = new Set(
      ensureArray(config.noReplyDomains)
        .map((domain) =>
          domain && typeof domain === "string"
            ? domain.replace(/^@/, "").trim().toLowerCase()
            : null
        )
        .filter((domain) => domain && domain.length > 0)
    );
    this.lastAllowListRefresh = 0;
  }

  async ensureDatabaseConnection() {
    if (this.connected) {
      return;
    }
    await db.authenticate();
    // No llamar a sync para evitar migraciones involuntarias en ejecuciones programadas
    this.connected = true;
    await this.refreshDynamicAllowLists(true);
  }

  async getSmtpTransporter() {
    if (!this.config.outboundEnabled) {
      return null;
    }

    if (this.smtpTransporter) {
      return this.smtpTransporter;
    }

    const {
      smtpHost,
      smtpPort,
      smtpSecure,
      smtpUser,
      smtpPassword,
      imapHost,
      imapUser,
      imapPassword,
    } = this.config;

    let resolvedHost =
      smtpHost && smtpHost.trim().length ? smtpHost.trim() : imapHost;
    if (resolvedHost && resolvedHost.startsWith("imap.")) {
      resolvedHost = resolvedHost.replace(/^imap\./i, "smtp.");
    }
    const resolvedUser =
      smtpUser && smtpUser.trim().length ? smtpUser.trim() : imapUser?.trim();
    const resolvedPassword =
      smtpPassword && smtpPassword.trim().length
        ? smtpPassword.trim()
        : imapPassword?.trim();

    if (!resolvedHost || !resolvedUser || !resolvedPassword) {
      console.warn(
        "[EmailTicketProcessor] Configuración SMTP incompleta, no se enviará acuse de recibo."
      );
      this.config.outboundEnabled = false;
      return null;
    }

    this.smtpTransporter = nodemailer.createTransport({
      host: resolvedHost,
      port: typeof smtpPort === "number" && smtpPort > 0 ? smtpPort : 465,
      secure: typeof smtpSecure === "boolean" ? smtpSecure : true,
      auth: {
        user: resolvedUser,
        pass: resolvedPassword,
      },
    });

    return this.smtpTransporter;
  }

  async enviarAcuseRecibo({
    destinatario,
    ticket,
    asuntoOriginal,
    clienteNombre,
  }) {
    try {
      const transporter = await this.getSmtpTransporter();
      if (!transporter || !destinatario) {
        return;
      }

      const {
        outboundFromAddress,
        outboundFromName,
        outboundSubjectPrefix,
        outboundAckBodyTemplate,
        smtpUser,
        imapUser,
      } = this.config;

      const fromAddress =
        outboundFromAddress && outboundFromAddress.trim().length
          ? outboundFromAddress.trim()
          : smtpUser || imapUser;

      if (!fromAddress) {
        console.warn(
          "[EmailTicketProcessor] No se pudo determinar el remitente para el acuse de recibo."
        );
        return;
      }

      const from = outboundFromName
        ? `${outboundFromName} <${fromAddress}>`
        : fromAddress;

      const subjectBase =
        asuntoOriginal && asuntoOriginal.trim().length
          ? asuntoOriginal.trim()
          : ticket?.titulo || "Ticket sin asunto";
      const subject = `${
        outboundSubjectPrefix ?? "[Ticket creado]"
      } [Ticket #${ticket?.id ?? ""}] ${subjectBase}`.trim();

      const cuerpoBase =
        outboundAckBodyTemplate ??
        "Hola,\n\nAcusamos recibo de tu correo. Se ha creado el ticket #{ticketId}.\n\nSaludos,\nMesa de Ayuda";
      const body = cuerpoBase
        .replaceAll("{ticketId}", `${ticket?.id ?? ""}`)
        .replaceAll("{ticketTitle}", ticket?.titulo ?? subjectBase)
        .replaceAll("{originalSubject}", subjectBase)
        .replaceAll("{clientName}", clienteNombre ?? "")
        .replaceAll(
          "{createdAt}",
          ticket?.createdAt?.toISOString?.() ?? new Date().toISOString()
        );

      await transporter.sendMail({
        from,
        to: destinatario,
        subject,
        text: body,
      });
    } catch (error) {
      console.error(
        "[EmailTicketProcessor] Error al enviar acuse de recibo:",
        error
      );
    }
  }

  isSenderAllowed(email) {
    const normalized = normalizeEmail(email);
    if (!normalized) {
      return false;
    }

    const domain = normalized.split("@")[1];
    const hasEmailAllow = this.allowedEmails.size > 0;
    const hasDomainAllow = this.allowedDomains.size > 0;

    if (hasEmailAllow && this.allowedEmails.has(normalized)) {
      return true;
    }

    if (
      hasDomainAllow &&
      domain &&
      this.allowedDomains.has(domain.toLowerCase())
    ) {
      return true;
    }

    if (hasEmailAllow || hasDomainAllow) {
      return false;
    }

    return true;
  }

  shouldSendReply(email) {
    const normalized = normalizeEmail(email);
    if (!normalized) {
      return false;
    }

    // Check if exact email is in no-reply list
    if (this.noReplyEmails.has(normalized)) {
      return false;
    }

    // Check if domain is in no-reply list
    const domain = normalized.split("@")[1];
    if (domain && this.noReplyDomains.has(domain.toLowerCase())) {
      return false;
    }

    return true;
  }

  async refreshDynamicAllowLists(force = false) {
    const now = Date.now();
    if (
      !force &&
      now - this.lastAllowListRefresh < ALLOWLIST_REFRESH_INTERVAL_MS
    ) {
      return;
    }

    try {
      const [casas, cuentas] = await Promise.all([
        CasaMatrizModel.findAll({
          attributes: ["correo"],
          raw: true,
        }),
        CuentaModel.findAll({
          attributes: ["email"],
          raw: true,
        }),
      ]);

      const agregarCorreo = (correo) => {
        const normalizado = normalizeEmail(correo);
        if (!normalizado) {
          return;
        }
        const dominio = normalizado.split("@")[1];
        if (!dominio || FREE_EMAIL_DOMAINS.has(dominio)) {
          return;
        }
        this.allowedEmails.add(normalizado);
        this.allowedDomains.add(dominio.toLowerCase());
      };

      casas.forEach(({ correo }) => agregarCorreo(correo));
      cuentas.forEach(({ email }) => agregarCorreo(email));

      this.config.allowedSenderEmails = Array.from(this.allowedEmails);
      this.config.allowedSenderDomains = Array.from(this.allowedDomains);
      this.lastAllowListRefresh = now;
    } catch (error) {
      console.error(
        "[EmailTicketProcessor] Error al refrescar remitentes permitidos dinámicos:",
        error
      );
    }
  }

  async resolveClienteDesdeCorreo(email) {
    const normalized = normalizeEmail(email);
    if (!normalized) {
      return null;
    }

    let casaMatriz = await CasaMatrizModel.findOne({
      where: db.where(db.fn("LOWER", db.col("correo")), normalized),
    });

    const cuenta = await CuentaModel.findOne({
      where: db.where(db.fn("LOWER", db.col("email")), normalized),
      include: [
        {
          model: CasaMatrizModel,
          as: "clientesAutorizados",
          through: { attributes: [] },
        },
      ],
    });

    if (cuenta) {
      const clientes = Array.isArray(cuenta.clientesAutorizados)
        ? cuenta.clientesAutorizados
        : [];

      if (clientes.length === 1 && !casaMatriz) {
        casaMatriz = clientes[0];
      } else if (!casaMatriz) {
        const clientePorCorreo = clientes.find(
          (cliente) =>
            typeof cliente.correo === "string" &&
            normalizeEmail(cliente.correo) === normalized
        );

        if (clientePorCorreo) {
          casaMatriz = clientePorCorreo;
        } else if (clientes.length > 0) {
          casaMatriz = clientes[0];
        }
      }

      return { casaMatriz: casaMatriz ?? null, cuenta };
    }

    return { casaMatriz: casaMatriz ?? null, cuenta: null };
  }

  async findExistingTicketForThread({
    casaMatrizId,
    creatorEmail,
    subject,
    parsedSubjectTicketId,
  }) {
    if (Number.isInteger(parsedSubjectTicketId)) {
      const ticketById = await TicketModel.findByPk(parsedSubjectTicketId);
      if (ticketById && `${ticketById.casaMatrizId}` === `${casaMatrizId}`) {
        return ticketById;
      }
    }

    const asuntoNormalizado = normalizeThreadSubject(subject);
    if (!asuntoNormalizado) {
      return null;
    }

    const where = {
      fuente: "Email",
      casaMatrizId,
      titulo: { [Op.ne]: null },
    };

    if (creatorEmail) {
      where.creatorEmail = creatorEmail;
    }

    const candidatos = await TicketModel.findAll({
      where,
      attributes: ["id", "titulo", "createdAt", "casaMatrizId", "creatorEmail"],
      order: [["createdAt", "DESC"]],
      limit: 25,
    });

    const ahora = Date.now();

    return (
      candidatos.find((ticket) => {
        const createdAtMs = new Date(ticket.createdAt).getTime();
        const dentroVentana =
          Number.isFinite(createdAtMs) &&
          ahora - createdAtMs <= THREAD_MATCH_WINDOW_DAYS * 24 * 60 * 60 * 1000;

        return (
          dentroVentana &&
          normalizeThreadSubject(ticket.titulo || "") === asuntoNormalizado
        );
      }) || null
    );
  }

  async registrarCorreoEnTicket({
    ticket,
    cuentaId,
    cuentaRemitente,
    parsedEmail,
    asunto,
    cuerpo,
    adjuntos,
    correoDate,
  }) {
    await ActividadTicketModel.create({
      ticketId: ticket.id,
      cuentaId,
      tipo: "comentario",
      valorNuevo: asunto,
      metadata: {
        origen: "email",
        asunto,
        cuerpo,
        adjuntos,
        remitenteNombre:
          getSenderName(parsedEmail.from) ||
          cuentaRemitente?.name ||
          normalizeEmail(primaryAddress(parsedEmail.from)) ||
          "Correo",
        remitenteEmail: normalizeEmail(primaryAddress(parsedEmail.from)),
        remitenteCuentaId: cuentaRemitente?.id || null,
        remitenteTipoCuentaId: cuentaRemitente?.tipoCuentaId || null,
        sourceTicketId: ticket.id,
        estadoTicket: ticket.estadoTicket || null,
      },
      createdAt: correoDate,
    });

    await ticket.update(
      {
        actualizadoPorId: cuentaId,
      },
      {
        silent: false,
      },
    );
  }

  async crearTicketDesdeCorreo(parsedEmail, metadata = {}) {
    const remitente = primaryAddress(parsedEmail.from);
    if (!remitente) {
      throw new Error("No fue posible determinar el remitente del correo.");
    }

    if (!this.isSenderAllowed(remitente)) {
      throw new Error(
        `El remitente ${remitente} no esta autorizado para crear tickets automaticamente.`
      );
    }

    const resultado = await this.resolveClienteDesdeCorreo(remitente);
    let casaMatriz = resultado?.casaMatriz ?? null;
    const cuentaRemitente = resultado?.cuenta ?? null;

    if (!casaMatriz && this.config.fallbackCasaMatrizId) {
      casaMatriz = await CasaMatrizModel.findByPk(
        this.config.fallbackCasaMatrizId
      );
    }

    if (!casaMatriz) {
      throw new Error(
        `No se encontro un cliente asociado al correo ${remitente} y no hay fallback configurado.`
      );
    }

    let creadorId = null;
    if (this.config.useSenderAccountAsCreator && cuentaRemitente) {
      creadorId = cuentaRemitente.id;
    } else if (this.config.defaultCreatorAccountId) {
      creadorId = this.config.defaultCreatorAccountId;
    } else if (cuentaRemitente) {
      creadorId = cuentaRemitente.id;
    }

    if (!creadorId) {
      throw new Error(
        "No se pudo determinar el usuario creador del ticket (configure TICKET_INBOUND_FALLBACK_CREATOR_ID)."
      );
    }

    const correoDate = toValidDate(
      metadata.internalDate ?? parsedEmail.date ?? new Date()
    );

    const tituloBase =
      typeof parsedEmail.subject === "string" &&
      parsedEmail.subject.trim().length
        ? parsedEmail.subject.trim()
        : "Ticket sin asunto";
    const parsedSubjectTicketId = extractTicketIdFromSubject(tituloBase);

    const cuerpoBase = cleanBody(parsedEmail);
    const cuerpoFormateado = enhanceBodyText(cuerpoBase);

    const descripcionFinal = [
      cuerpoFormateado.length
        ? cuerpoFormateado
        : "Ticket generado automaticamente desde correo sin contenido de texto.",
      "",
      "---",
      "",
      `Correo original: ${remitente}`,
      "",
      `Nombre remitente: ${
        getSenderName(parsedEmail.from) ?? "No especificado"
      }`,
    ]
      .join("\n")
      .trim();

    const attachments = Array.isArray(parsedEmail.attachments)
      ? parsedEmail.attachments.filter((attachment) => {
          const disposition = (
            attachment.contentDisposition || ""
          ).toLowerCase();
          if (disposition === "inline") {
            return false;
          }
          if (attachment.cid) {
            return false;
          }
          const contentType = (attachment.contentType || "").toLowerCase();
          if (contentType === "application/pkcs7-signature") {
            return false;
          }
          if (!attachment.content || !attachment.content.length) {
            return false;
          }
          return true;
        })
      : [];

    const archivosSubidos = [];
    for (const attachment of attachments) {
      try {
        const referencia = await uploadAttachmentToGcs(attachment);
        if (referencia) {
          archivosSubidos.push(referencia);
        }
      } catch (error) {
        console.error(
          "Error al subir un adjunto a GCS. Continuando con el resto:",
          error
        );
      }
    }

    // No asignar técnicos para tickets creados por email - estado "Nuevo"
    const tecnicos = [];

    const fechaVisita = toDateOnly(correoDate, this.config.timezone);

    const ticketExistente = await this.findExistingTicketForThread({
      casaMatrizId: casaMatriz.id,
      creatorEmail: normalizeEmail(remitente) || remitente,
      subject: tituloBase,
      parsedSubjectTicketId,
    });

    if (ticketExistente) {
      await this.registrarCorreoEnTicket({
        ticket: ticketExistente,
        cuentaId: creadorId,
        cuentaRemitente,
        parsedEmail,
        asunto: tituloBase,
        cuerpo:
          cuerpoFormateado ||
          "Correo incorporado automaticamente al hilo sin contenido de texto.",
        adjuntos: archivosSubidos,
        correoDate,
      });

      return ticketExistente;
    }

    const nuevoTicket = await TicketModel.create({
      casaMatrizId: casaMatriz.id,
      sucursalId: null,
      fechaVisita,
      horaLlegada: correoDate,
      horaSalida: null,
      tecnicos,
      tecnicoAsignadoId: null,
      descripcion: descripcionFinal,
      titulo: tituloBase,
      creadoPorId: creadorId,
      actualizadoPorId: creadorId,
      isEmergencia: false,
      estadoTicket: ESTADO_TICKET_INGRESADO,
      fechaTermino: null,
      detalleTermino: null,
      adjuntos: archivosSubidos,
      adjuntosTermino: [],
      createdAt: correoDate,
      updatedAt: correoDate,
      fuente: "Email",
      creatorEmail: normalizeEmail(remitente) || remitente,
    });

    if (this.shouldSendReply(remitente)) {
      await this.enviarAcuseRecibo({
        destinatario: remitente,
        ticket: nuevoTicket,
        asuntoOriginal: tituloBase,
        clienteNombre: casaMatriz?.razonSocial ?? "",
      });
    } else {
      console.log(
        `[EmailTicketProcessor] Omitiendo acuse de recibo para ${remitente} (en lista no-reply).`
      );
    }

    return nuevoTicket;
  }

  async procesarBuzon() {
    if (!this.config.enabled) {
      console.log(
        "[EmailTicketProcessor] Integracion deshabilitada (TICKET_INBOUND_ENABLED=false)."
      );
      return { processed: 0, success: 0, errors: 0 };
    }

    await this.ensureDatabaseConnection();
    await this.refreshDynamicAllowLists(false);

    const client = new ImapFlow({
      host: this.config.imapHost,
      port: this.config.imapPort,
      secure: this.config.imapSecure,
      auth: {
        user: this.config.imapUser,
        pass: this.config.imapPassword,
      },
    });

    await client.connect();

    let lock;
    let processed = 0;
    let success = 0;
    let errors = 0;

    try {
      lock = await client.getMailboxLock(this.config.mailbox);

      const unseenMessages = await client.search({
        seen: false,
      });

      const unseenSorted = [...unseenMessages].sort((a, b) => b - a);

      const limit =
        typeof this.config.maxEmailsPerRun === "number" &&
        this.config.maxEmailsPerRun > 0
          ? this.config.maxEmailsPerRun
          : unseenSorted.length;

      const fetchedMessages = [];

      for (let index = 0; index < unseenSorted.length; index += 1) {
        if (index >= limit) {
          break;
        }

        const sequence = unseenSorted[index];
        const message = await client.fetchOne(sequence, {
          uid: true,
          envelope: true,
          source: true,
          internalDate: true,
        });

        processed += 1;

        try {
          const parsed = await simpleParser(message.source);
          fetchedMessages.push({
            uid: message.uid,
            internalDate: message.internalDate,
            parsed,
          });
        } catch (parseError) {
          errors += 1;
          console.error(
            "[EmailTicketProcessor] Error al parsear correo:",
            parseError
          );

          if (this.config.markSeenOnError) {
            try {
              await client.messageFlagsAdd(message.uid, ["\\Seen"], {
                uid: true,
              });
            } catch (flagError) {
              console.error(
                "[EmailTicketProcessor] Error al marcar correo fallido como visto:",
                flagError
              );
            }
          }
        }
      }

      const orderedBatch = fetchedMessages.sort((a, b) => {
        const dateA = a.internalDate ? new Date(a.internalDate) : new Date(0);
        const dateB = b.internalDate ? new Date(b.internalDate) : new Date(0);
        return dateA.getTime() - dateB.getTime();
      });

      for (const item of orderedBatch) {
        try {
          await this.crearTicketDesdeCorreo(item.parsed, {
            internalDate: item.internalDate,
            uid: item.uid,
          });
          success += 1;

          await client.messageFlagsAdd(item.uid, ["\\Seen"], { uid: true });

          if (this.config.archiveMailboxOnSuccess) {
            try {
              await client.messageMove(
                item.uid,
                this.config.archiveMailboxOnSuccess,
                { uid: true }
              );
            } catch (moveError) {
              console.error(
                `[EmailTicketProcessor] No se pudo mover el correo procesado al buzón ${this.config.archiveMailboxOnSuccess}:`,
                moveError
              );
            }
          }
        } catch (error) {
          errors += 1;
          console.error(
            "[EmailTicketProcessor] Error al procesar correo y crear ticket:",
            error
          );

          if (this.config.markSeenOnError) {
            try {
              await client.messageFlagsAdd(item.uid, ["\\Seen"], {
                uid: true,
              });
            } catch (flagError) {
              console.error(
                "[EmailTicketProcessor] Error al marcar correo fallido como visto:",
                flagError
              );
            }
          }
        }
      }
    } finally {
      if (lock) {
        lock.release();
      }
      await client.logout();
    }

    return { processed, success, errors };
  }
}

export default EmailTicketProcessor;
