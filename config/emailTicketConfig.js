const toBoolean = (value, defaultValue = false) => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value !== "string") {
    return defaultValue;
  }
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no", "n"].includes(normalized)) {
    return false;
  }
  return defaultValue;
};

const parseInteger = (value, defaultValue = null) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value !== "string") {
    return defaultValue;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : defaultValue;
};

const parseList = (value, defaultValue = []) => {
  if (!value) {
    return Array.isArray(defaultValue) ? defaultValue : [];
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => `${item}`.trim())
      .filter((item) => item.length > 0);
  }
  return `${value}`
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

const emailTicketConfig = {
  enabled: toBoolean(process.env.TICKET_INBOUND_ENABLED, false),
  imapHost: process.env.TICKET_INBOUND_IMAP_HOST ?? "",
  imapPort: parseInteger(process.env.TICKET_INBOUND_IMAP_PORT, 993),
  imapSecure: toBoolean(process.env.TICKET_INBOUND_IMAP_SECURE, true),
  imapUser: process.env.TICKET_INBOUND_IMAP_USER ?? "",
  imapPassword: process.env.TICKET_INBOUND_IMAP_PASSWORD ?? "",
  mailbox: process.env.TICKET_INBOUND_IMAP_MAILBOX ?? "INBOX",
  pollIntervalMs: parseInteger(
    process.env.TICKET_INBOUND_POLL_INTERVAL_MS,
    60000
  ),
  maxEmailsPerRun: parseInteger(
    process.env.TICKET_INBOUND_MAX_EMAILS_PER_RUN,
    10
  ),
  defaultTechnicians: parseList(
    process.env.TICKET_INBOUND_DEFAULT_TECHNICIANS,
    ["Mesa de ayuda"]
  ),
  fallbackCasaMatrizId: process.env.TICKET_INBOUND_FALLBACK_CLIENT_ID ?? null,
  defaultCreatorAccountId: parseInteger(
    process.env.TICKET_INBOUND_FALLBACK_CREATOR_ID,
    null
  ),
  useSenderAccountAsCreator: toBoolean(
    process.env.TICKET_INBOUND_USE_SENDER_ACCOUNT_AS_CREATOR,
    true
  ),
  markSeenOnError: toBoolean(
    process.env.TICKET_INBOUND_MARK_SEEN_ON_ERROR,
    false
  ),
  allowedSenderEmails: parseList(
    process.env.TICKET_INBOUND_ALLOWED_SENDER_EMAILS,
    []
  ),
  allowedSenderDomains: parseList(
    process.env.TICKET_INBOUND_ALLOWED_SENDER_DOMAINS,
    []
  ),
  noReplyEmails: parseList(process.env.TICKET_INBOUND_NO_REPLY_EMAILS, []),
  noReplyDomains: parseList(process.env.TICKET_INBOUND_NO_REPLY_DOMAINS, []),
  archiveMailboxOnSuccess: process.env.TICKET_INBOUND_ARCHIVE_MAILBOX ?? null,
  timezone: process.env.TICKET_INBOUND_TIMEZONE ?? "America/Santiago",
  cronExpression: process.env.TICKET_INBOUND_CRON_EXPRESSION ?? "*/5 * * * *",
  outboundEnabled: toBoolean(
    process.env.TICKET_OUTBOUND_ENABLED ?? "true",
    true
  ),
  smtpHost:
    process.env.TICKET_OUTBOUND_SMTP_HOST ??
    process.env.TICKET_INBOUND_SMTP_HOST ??
    "",
  smtpPort: parseInteger(process.env.TICKET_OUTBOUND_SMTP_PORT, 465),
  smtpSecure: toBoolean(
    process.env.TICKET_OUTBOUND_SMTP_SECURE ?? "true",
    true
  ),
  smtpUser: process.env.TICKET_OUTBOUND_SMTP_USER ?? "",
  smtpPassword: process.env.TICKET_OUTBOUND_SMTP_PASSWORD ?? "",
  outboundFromAddress:
    process.env.TICKET_OUTBOUND_FROM_ADDRESS ??
    process.env.TICKET_INBOUND_SMTP_USER ??
    "",
  outboundFromName: process.env.TICKET_OUTBOUND_FROM_NAME ?? "Mesa de Ayuda",
  outboundSubjectPrefix:
    process.env.TICKET_OUTBOUND_SUBJECT_PREFIX ?? "[Ticket creado]",
  outboundAckBodyTemplate:
    process.env.TICKET_OUTBOUND_ACK_TEMPLATE ??
    'Hola,\n\nAcuso recibo: el ticket #{ticketId} ha sido creado correctamente con el asunto "{ticketTitle}".\n\nNuestro equipo revisará tu solicitud y se pondrá en contacto contigo a la brevedad.\n\nSaludos,\nMesa de Ayuda',
};

export { emailTicketConfig, parseList, parseInteger, toBoolean };
