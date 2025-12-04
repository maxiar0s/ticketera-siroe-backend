-- Migration script to update ticket states

-- Update 'ingresado' to 'Nuevo'
UPDATE Tickets SET estadoTicket = 'Nuevo' WHERE estadoTicket = 'ingresado';

-- Update 'terminado' to 'Cerrado'
UPDATE Tickets SET estadoTicket = 'Cerrado' WHERE estadoTicket = 'terminado';

-- Optional: Verify changes
-- SELECT id, estadoTicket FROM Tickets;
