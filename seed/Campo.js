const Campos = [
    { name: 'marca', label: 'Marca', type: 'text', placeholder: 'Ingresa la marca del equipo', required: 0, }, 
    { name: 'modelo', label: 'Modelo', type: 'text', placeholder: 'Escribe el modelo', required: 0, },
    { name: 'imagen', label: 'Registro fotográfico', type: 'file', placeholder: 'Toma o sube una foto del equipo', required: 0, },
    { name: 'numeroSerie', label: 'Número de Serie', type: 'text', placeholder: 'Introduce el número de serie', required: 0, },
    { name: 'procesador', label: 'Procesador', type: 'text', placeholder: 'Específica el procesador', required: 0 },
    { name: 'velocidadProcesador', label: 'Velocidad del Procesador (GHz)', type: 'text', placeholder: 'Indica la velocidad del procesador', required: 0 },
    { name: 'ram', label: 'RAM (GB)', type: 'number', placeholder: 'Escribe la RAM', required: 0 },
    { name: 'tipoAlmacenamiento', label: 'Tipo de Almacenamiento', type: 'text', placeholder: 'Ingresa el tipo de almacenamiento', required: 0 },
    { name: 'cantidadAlmacenamiento', label: 'Capacidad de Almacenamiento', type: 'number', placeholder: 'Escribe la cantidad de almacenamiento', required: 0 },
    { name: 'sistemaOperativo', label: 'Sistema Operativo', type: 'text', placeholder: 'Ingresa el sistema operativo', required: 0 },
    { name: 'ofimatica', label: 'Ofimática', type: 'text', placeholder: 'Indica la suite de ofimática instalada' },
    { name: 'antivirus', label: 'Antivirus', type: 'text', placeholder: 'Ingrese el antivirus', required: 0 },
]

export default Campos;