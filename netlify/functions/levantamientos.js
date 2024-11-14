// netlify/functions/levantamientos.js
import { levantamiento } from '../../models/index.js'; // Usa `require` en lugar de `import`

export async function handler(event, context) { // Usa `module.exports` para exportar la función
    const levantamientos = await levantamiento.findAll();
  
    return {
        statusCode: 200,
        body: JSON.stringify(levantamientos),
    };
}
