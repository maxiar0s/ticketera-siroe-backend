// ID Campos Referencia
const Campo = [
    { id: 1, name: 'Marca' },
    { id: 2, name: 'Modelo' },
    { id: 3, name: 'Placa madre' },
    { id: 4, name: 'Fuente de poder' },
    { id: 5, name: 'Imagen' },
    { id: 6, name: 'Numero de serie' },
    { id: 7, name: 'Procesador' },
    { id: 8, name: 'Velocidad de procesador' },
    { id: 9, name: 'Ram' },
    { id: 10, name: 'Tipo de almacenamiento' },
    { id: 11, name: 'Cantidad de almacenamiento' },
    { id: 12, name: 'Sistema operativo' },
    { id: 13, name: 'Ofimatica' },
    { id: 14, name: 'Antivirus' },
];

// Id TipoEquipo Referencia
const TipoEquipo = [
    { id: 1, name: 'Televisor' },
    { id: 2, name: 'Celular' },
    { id: 3, name: 'Notebook' },
    { id: 4, name: 'Data Show' },
    { id: 5, name: 'Tablet' },
    { id: 6, name: 'Pizarra Interactiva' },
    { id: 7, name: 'Sistema de Audio' },
    { id: 8, name: 'Aire Acondicionado' },
    { id: 9, name: 'All in One' },
    { id: 10, name: 'Impresora' },
    { id: 11, name: 'Ordenador de Escritorio' },
];

const TipoEquipoCampo = [
    // Televisor con 4 campos
    { tipoEquipoId: TipoEquipo[0].id, campoId: Campo[0].id },
    { tipoEquipoId: TipoEquipo[0].id, campoId: Campo[1].id },
    { tipoEquipoId: TipoEquipo[0].id, campoId: Campo[4].id },
    { tipoEquipoId: TipoEquipo[0].id, campoId: Campo[5].id },

    // Celular con 9 campos
    { tipoEquipoId: TipoEquipo[1].id, campoId: Campo[0].id },
    { tipoEquipoId: TipoEquipo[1].id, campoId: Campo[1].id },
    { tipoEquipoId: TipoEquipo[1].id, campoId: Campo[4].id },
    { tipoEquipoId: TipoEquipo[1].id, campoId: Campo[6].id },
    { tipoEquipoId: TipoEquipo[1].id, campoId: Campo[7].id },
    { tipoEquipoId: TipoEquipo[1].id, campoId: Campo[8].id },
    { tipoEquipoId: TipoEquipo[1].id, campoId: Campo[10].id },
    { tipoEquipoId: TipoEquipo[1].id, campoId: Campo[11].id },
    
    // Notebook con 12 campos
    { tipoEquipoId: TipoEquipo[2].id, campoId: Campo[0].id },
    { tipoEquipoId: TipoEquipo[2].id, campoId: Campo[1].id },
    { tipoEquipoId: TipoEquipo[2].id, campoId: Campo[4].id },
    { tipoEquipoId: TipoEquipo[2].id, campoId: Campo[5].id },
    { tipoEquipoId: TipoEquipo[2].id, campoId: Campo[6].id },
    { tipoEquipoId: TipoEquipo[2].id, campoId: Campo[7].id },
    { tipoEquipoId: TipoEquipo[2].id, campoId: Campo[8].id },
    { tipoEquipoId: TipoEquipo[2].id, campoId: Campo[9].id },
    { tipoEquipoId: TipoEquipo[2].id, campoId: Campo[10].id },
    { tipoEquipoId: TipoEquipo[2].id, campoId: Campo[11].id },
    { tipoEquipoId: TipoEquipo[2].id, campoId: Campo[12].id },
    { tipoEquipoId: TipoEquipo[2].id, campoId: Campo[13].id },
    
    // Data Show con 4 campos
    { tipoEquipoId: TipoEquipo[3].id, campoId: Campo[0].id },
    { tipoEquipoId: TipoEquipo[3].id, campoId: Campo[1].id },
    { tipoEquipoId: TipoEquipo[3].id, campoId: Campo[4].id },
    { tipoEquipoId: TipoEquipo[3].id, campoId: Campo[5].id },
    
    // Tablet con 9 campos
    { tipoEquipoId: TipoEquipo[4].id, campoId: Campo[0].id },
    { tipoEquipoId: TipoEquipo[4].id, campoId: Campo[1].id },
    { tipoEquipoId: TipoEquipo[4].id, campoId: Campo[4].id },
    { tipoEquipoId: TipoEquipo[4].id, campoId: Campo[5].id },
    { tipoEquipoId: TipoEquipo[4].id, campoId: Campo[6].id },
    { tipoEquipoId: TipoEquipo[4].id, campoId: Campo[7].id },
    { tipoEquipoId: TipoEquipo[4].id, campoId: Campo[8].id },
    { tipoEquipoId: TipoEquipo[4].id, campoId: Campo[10].id },
    { tipoEquipoId: TipoEquipo[4].id, campoId: Campo[11].id },
    
    // Pizarra Interactiva con 4 campos
    { tipoEquipoId: TipoEquipo[5].id, campoId: Campo[0].id },
    { tipoEquipoId: TipoEquipo[5].id, campoId: Campo[1].id },
    { tipoEquipoId: TipoEquipo[5].id, campoId: Campo[11].id },
    
    // Sistema de Audio con 3 campos
    { tipoEquipoId: TipoEquipo[6].id, campoId: Campo[0].id },
    { tipoEquipoId: TipoEquipo[6].id, campoId: Campo[1].id },
    { tipoEquipoId: TipoEquipo[6].id, campoId: Campo[4].id },
    
    // Aire Acondicionado con 3 campos
    { tipoEquipoId: TipoEquipo[7].id, campoId: Campo[0].id },
    { tipoEquipoId: TipoEquipo[7].id, campoId: Campo[1].id },
    { tipoEquipoId: TipoEquipo[7].id, campoId: Campo[4].id },

    // All in One con 11 campos
    { tipoEquipoId: TipoEquipo[8].id, campoId: Campo[0].id },
    { tipoEquipoId: TipoEquipo[8].id, campoId: Campo[1].id },
    { tipoEquipoId: TipoEquipo[8].id, campoId: Campo[4].id },
    { tipoEquipoId: TipoEquipo[8].id, campoId: Campo[5].id },
    { tipoEquipoId: TipoEquipo[8].id, campoId: Campo[6].id },
    { tipoEquipoId: TipoEquipo[8].id, campoId: Campo[7].id },
    { tipoEquipoId: TipoEquipo[8].id, campoId: Campo[8].id },
    { tipoEquipoId: TipoEquipo[8].id, campoId: Campo[9].id },
    { tipoEquipoId: TipoEquipo[8].id, campoId: Campo[10].id },
    { tipoEquipoId: TipoEquipo[8].id, campoId: Campo[11].id },
    { tipoEquipoId: TipoEquipo[8].id, campoId: Campo[12].id },
    { tipoEquipoId: TipoEquipo[8].id, campoId: Campo[13].id },
    
    // Impresora con 4 campos
    { tipoEquipoId: TipoEquipo[9].id, campoId: Campo[0].id },
    { tipoEquipoId: TipoEquipo[9].id, campoId: Campo[1].id },
    { tipoEquipoId: TipoEquipo[9].id, campoId: Campo[4].id },
    { tipoEquipoId: TipoEquipo[9].id, campoId: Campo[5].id },
    
    // Ordenador de Escritorio con 10 campos
    { tipoEquipoId: TipoEquipo[10].id, campoId: Campo[2].id },
    { tipoEquipoId: TipoEquipo[10].id, campoId: Campo[3].id },
    { tipoEquipoId: TipoEquipo[10].id, campoId: Campo[4].id },
    { tipoEquipoId: TipoEquipo[10].id, campoId: Campo[6].id },
    { tipoEquipoId: TipoEquipo[10].id, campoId: Campo[7].id },
    { tipoEquipoId: TipoEquipo[10].id, campoId: Campo[8].id },
    { tipoEquipoId: TipoEquipo[10].id, campoId: Campo[9].id },
    { tipoEquipoId: TipoEquipo[10].id, campoId: Campo[10].id },
    { tipoEquipoId: TipoEquipo[10].id, campoId: Campo[11].id },
    { tipoEquipoId: TipoEquipo[10].id, campoId: Campo[12].id },
    { tipoEquipoId: TipoEquipo[10].id, campoId: Campo[13].id },
] 

export default TipoEquipoCampo;