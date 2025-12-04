ALTER TABLE Tickets ADD COLUMN prioridad ENUM('Baja', 'Media', 'Alta') NOT NULL DEFAULT 'Media';
ALTER TABLE Tickets ADD COLUMN tipo ENUM('Incidente', 'Problema', 'Pregunta', 'Peticion') NOT NULL DEFAULT 'Incidente';
ALTER TABLE Tickets ADD COLUMN fuente ENUM('Web', 'Email') NOT NULL DEFAULT 'Web';
ALTER TABLE Tickets ADD COLUMN fechaRespuesta DATETIME NULL;
ALTER TABLE Tickets ADD COLUMN historialEstados TEXT NULL;
