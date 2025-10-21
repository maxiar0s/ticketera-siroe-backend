import 'dotenv/config';
import db from '../config/db.js';
import {
  DepartamentoEquipoModel,
  EquipoModel,
} from '../models/index.js';
import { Op, fn, col } from 'sequelize';

const normalizarNombre = (valor) => {
  if (!valor) {
    return null;
  }
  const texto = `${valor}`.trim();
  return texto.length ? texto : null;
};

const main = async () => {
  console.log('▶ Iniciando sincronización de departamentos…');
  await db.authenticate();
  await DepartamentoEquipoModel.sync();

  const existentes = await DepartamentoEquipoModel.findAll({
    attributes: ['name'],
    raw: true,
  });

  const existentesMap = new Map(
    existentes.map((item) => [item.name.toLowerCase(), item.name]),
  );

  const desdeEquipos = await EquipoModel.findAll({
    attributes: [[fn('DISTINCT', col('departamento')), 'departamento']],
    where: {
      departamento: {
        [Op.ne]: null,
      },
    },
    raw: true,
  });

  let creados = 0;
  for (const registro of desdeEquipos) {
    const nombre = normalizarNombre(registro.departamento);
    if (!nombre) {
      continue;
    }

    const clave = nombre.toLowerCase();
    if (existentesMap.has(clave)) {
      continue;
    }

    await DepartamentoEquipoModel.create({ name: nombre });
    existentesMap.set(clave, nombre);
    creados += 1;
    console.log(`  • Departamento agregado: ${nombre}`);
  }

  console.log(
    creados
      ? `✅ Sincronización completada. Departamentos creados: ${creados}.`
      : 'ℹ️ No se encontraron departamentos nuevos para registrar.',
  );
  process.exit(0);
};

main().catch((error) => {
  console.error('❌ Error al sincronizar departamentos:', error);
  process.exit(1);
});
