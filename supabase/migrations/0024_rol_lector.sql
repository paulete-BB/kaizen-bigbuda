-- Rol de solo lectura: ve Dashboard, Calendario, Clientes y Resultados, pero
-- ninguna acción que escriba (las acciones del servidor lo rechazan, ver
-- `requireWriter` en lib/auth/server.ts). Solo agrega el valor al enum.
alter type user_rol add value if not exists 'lector';
