// ID Campos Referencia
const Campo = [
    { id: 1, name: 'Marca' },
    { id: 2, name: 'Modelo' },
    { id: 3, name: 'Imagen' },
    { id: 4, name: 'Numero de serie' },
    { id: 5, name: 'Procesador' },
    { id: 6, name: 'Velocidad de procesador' },
    { id: 7, name: 'Ram' },
    { id: 8, name: 'Tipo de almacenamiento' },
    { id: 9, name: 'Cantidad de almacenamiento' },
    { id: 10, name: 'Sistema operativo' },
    { id: 11, name: 'Ofimatica' },
    { id: 12, name: 'Antivirus' },
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
    { tipoEquipoId: TipoEquipo[0].id, campoId: Campo[2].id },
    { tipoEquipoId: TipoEquipo[0].id, campoId: Campo[3].id },
    
    // Celular con 9 campos
    { tipoEquipoId: TipoEquipo[1].id, campoId: Campo[0].id },
    { tipoEquipoId: TipoEquipo[1].id, campoId: Campo[1].id },
    { tipoEquipoId: TipoEquipo[1].id, campoId: Campo[2].id },
    { tipoEquipoId: TipoEquipo[1].id, campoId: Campo[4].id },
    { tipoEquipoId: TipoEquipo[1].id, campoId: Campo[5].id },
    { tipoEquipoId: TipoEquipo[1].id, campoId: Campo[6].id },
    { tipoEquipoId: TipoEquipo[1].id, campoId: Campo[8].id },
    { tipoEquipoId: TipoEquipo[1].id, campoId: Campo[9].id },
    
    // Notebook con 12 campos
    { tipoEquipoId: TipoEquipo[2].id, campoId: Campo[0].id },
    { tipoEquipoId: TipoEquipo[2].id, campoId: Campo[1].id },
    { tipoEquipoId: TipoEquipo[2].id, campoId: Campo[2].id },
    { tipoEquipoId: TipoEquipo[2].id, campoId: Campo[3].id },
    { tipoEquipoId: TipoEquipo[2].id, campoId: Campo[4].id },
    { tipoEquipoId: TipoEquipo[2].id, campoId: Campo[5].id },
    { tipoEquipoId: TipoEquipo[2].id, campoId: Campo[6].id },
    { tipoEquipoId: TipoEquipo[2].id, campoId: Campo[7].id },
    { tipoEquipoId: TipoEquipo[2].id, campoId: Campo[8].id },
    { tipoEquipoId: TipoEquipo[2].id, campoId: Campo[9].id },
    { tipoEquipoId: TipoEquipo[2].id, campoId: Campo[10].id },
    { tipoEquipoId: TipoEquipo[2].id, campoId: Campo[11].id },
    
    // Data Show con 4 campos
    { tipoEquipoId: TipoEquipo[3].id, campoId: Campo[0].id },
    { tipoEquipoId: TipoEquipo[3].id, campoId: Campo[1].id },
    { tipoEquipoId: TipoEquipo[3].id, campoId: Campo[2].id },
    { tipoEquipoId: TipoEquipo[3].id, campoId: Campo[3].id },
    
    // Tablet con 9 campos
    { tipoEquipoId: TipoEquipo[4].id, campoId: Campo[0].id },
    { tipoEquipoId: TipoEquipo[4].id, campoId: Campo[1].id },
    { tipoEquipoId: TipoEquipo[4].id, campoId: Campo[2].id },
    { tipoEquipoId: TipoEquipo[4].id, campoId: Campo[3].id },
    { tipoEquipoId: TipoEquipo[4].id, campoId: Campo[4].id },
    { tipoEquipoId: TipoEquipo[4].id, campoId: Campo[5].id },
    { tipoEquipoId: TipoEquipo[4].id, campoId: Campo[6].id },
    { tipoEquipoId: TipoEquipo[4].id, campoId: Campo[8].id },
    { tipoEquipoId: TipoEquipo[4].id, campoId: Campo[9].id },
    
    // Pizarra Interactiva con 4 campos
    { tipoEquipoId: TipoEquipo[5].id, campoId: Campo[0].id },
    { tipoEquipoId: TipoEquipo[5].id, campoId: Campo[1].id },
    { tipoEquipoId: TipoEquipo[5].id, campoId: Campo[9].id },
    
    // Sistema de Audio con 3 campos
    { tipoEquipoId: TipoEquipo[6].id, campoId: Campo[0].id },
    { tipoEquipoId: TipoEquipo[6].id, campoId: Campo[1].id },
    { tipoEquipoId: TipoEquipo[6].id, campoId: Campo[2].id },
    
    // Aire Acondicionado con 3 campos
    { tipoEquipoId: TipoEquipo[7].id, campoId: Campo[0].id },
    { tipoEquipoId: TipoEquipo[7].id, campoId: Campo[1].id },
    { tipoEquipoId: TipoEquipo[7].id, campoId: Campo[2].id },

    // All in One con 11 campos
    { tipoEquipoId: TipoEquipo[8].id, campoId: Campo[0].id },
    { tipoEquipoId: TipoEquipo[8].id, campoId: Campo[1].id },
    { tipoEquipoId: TipoEquipo[8].id, campoId: Campo[2].id },
    { tipoEquipoId: TipoEquipo[8].id, campoId: Campo[3].id },
    { tipoEquipoId: TipoEquipo[8].id, campoId: Campo[4].id },
    { tipoEquipoId: TipoEquipo[8].id, campoId: Campo[5].id },
    { tipoEquipoId: TipoEquipo[8].id, campoId: Campo[6].id },
    { tipoEquipoId: TipoEquipo[8].id, campoId: Campo[7].id },
    { tipoEquipoId: TipoEquipo[8].id, campoId: Campo[8].id },
    { tipoEquipoId: TipoEquipo[8].id, campoId: Campo[9].id },
    { tipoEquipoId: TipoEquipo[8].id, campoId: Campo[10].id },
    { tipoEquipoId: TipoEquipo[8].id, campoId: Campo[11].id },
    
    // Impresora con 4 campos
    { tipoEquipoId: TipoEquipo[9].id, campoId: Campo[0].id },
    { tipoEquipoId: TipoEquipo[9].id, campoId: Campo[1].id },
    { tipoEquipoId: TipoEquipo[9].id, campoId: Campo[2].id },
    { tipoEquipoId: TipoEquipo[9].id, campoId: Campo[3].id },
    
    // Ordenador de Escritorio con 10 campos
    { tipoEquipoId: TipoEquipo[10].id, campoId: Campo[2].id },
    { tipoEquipoId: TipoEquipo[10].id, campoId: Campo[4].id },
    { tipoEquipoId: TipoEquipo[10].id, campoId: Campo[5].id },
    { tipoEquipoId: TipoEquipo[10].id, campoId: Campo[6].id },
    { tipoEquipoId: TipoEquipo[10].id, campoId: Campo[7].id },
    { tipoEquipoId: TipoEquipo[10].id, campoId: Campo[8].id },
    { tipoEquipoId: TipoEquipo[10].id, campoId: Campo[9].id },
    { tipoEquipoId: TipoEquipo[10].id, campoId: Campo[10].id },
    { tipoEquipoId: TipoEquipo[10].id, campoId: Campo[11].id },
] 

export default TipoEquipoCampo;