const Campos = [
    { name: 'marca', label: 'Marca', type: 'text', placeholder: 'Ingresa la marca del equipo', required: 0, }, 
    { name: 'modelo', label: 'Modelo', type: 'text', placeholder: 'Escribe el modelo', required: 0, },
    { name: 'placaMadre', label: 'Placa madre', type: 'text', placeholder: 'Escribe la placa madre', required: 0, },
    { name: 'fuenteDePoder', label: 'Fuente de poder', type: 'text', placeholder: 'Escribe la fuente de poder', required: 0, },
    { name: 'usuario', label: 'Usuario', type: 'text', placeholder: 'Escribe el usuario', required: 0, },
    { name: 'imagen', label: 'Registro fotográfico', type: 'file', placeholder: 'Toma o sube una foto del equipo', required: 0, },
    { name: 'numeroSerie', label: 'Número de Serie', type: 'text', placeholder: 'Introduce el número de serie', required: 0, },
    { name: 'procesador', label: 'Procesador', type: 'text', placeholder: 'Específica el procesador', required: 0 },
    { name: 'velocidadProcesador', label: 'Velocidad del Procesador (GHz)', type: 'text', placeholder: 'Indica la velocidad del procesador', required: 0 },
    { 
        name: 'ram', 
        label: 'RAM (GB)', 
        type: 'number', 
        placeholder: 'Escribe la RAM', 
        required: 0,
        presetOptions: [
            { label: '4 GB', value: '4', color: 'rojo' },
            { label: '8 GB', value: '8', color: 'amarillo' },
            { label: '16 GB', value: '16', color: 'verde' },
        ],
        standards: [
            { label: 'Recomendado: ≥ 16 GB', color: 'verde', operator: 'gte', value: 16, unit: 'GB' },
            { label: 'Mínimo aceptable: ≥ 8 GB', color: 'amarillo', operator: 'gte', value: 8, unit: 'GB' },
            { label: 'Obsoleto: < 6 GB', color: 'rojo', operator: 'lt', value: 6, unit: 'GB' },
        ],
    },
    { 
        name: 'tipoAlmacenamiento', 
        label: 'Tipo de Almacenamiento', 
        type: 'text', 
        placeholder: 'Ingresa el tipo de almacenamiento', 
        required: 0,
        presetOptions: [
            { label: 'SSD', value: 'SSD', color: 'verde' },
            { label: 'HDD', value: 'HDD', color: 'amarillo' },
        ],
        standards: [
            { label: 'SSD (recomendado)', color: 'verde', operator: 'eq', value: 'SSD' },
            { label: 'HDD (mínimo)', color: 'amarillo', operator: 'eq', value: 'HDD' },
            { label: 'Otro tipo de almacenamiento', color: 'rojo', description: 'Verificar actualización a SSD' },
        ],
    },
    { name: 'cantidadAlmacenamiento', label: 'Capacidad de Almacenamiento', type: 'number', placeholder: 'Escribe la cantidad de almacenamiento', required: 0 },
    { 
        name: 'sistemaOperativo', 
        label: 'Sistema Operativo', 
        type: 'text', 
        placeholder: 'Ingresa el sistema operativo', 
        required: 0,
        presetOptions: [
            { label: 'Windows 11', value: 'Windows 11', color: 'verde' },
            { label: 'Windows 10', value: 'Windows 10', color: 'amarillo' },
            { label: 'Windows 7 o inferior', value: 'Windows 7', color: 'rojo' },
        ],
        standards: [
            { label: 'Windows 11 (recomendado)', color: 'verde', operator: 'eq', value: 'Windows 11' },
            { label: 'Windows 10 (mínimo)', color: 'amarillo', operator: 'eq', value: 'Windows 10' },
            { label: 'Versiones anteriores a Windows 10', color: 'rojo', description: 'Obsoleto, requiere actualización' },
        ],
    },
    { name: 'ofimatica', label: 'Ofimática', type: 'text', placeholder: 'Indica la suite de ofimática instalada' },
    { name: 'antivirus', label: 'Antivirus', type: 'text', placeholder: 'Ingrese el antivirus', required: 0 },
]

export default Campos;
