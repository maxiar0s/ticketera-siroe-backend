// netlify/functions/levantamientos.js
import { levantamiento } from '../../models/index.js';

export async function handler(event, context) {
    const levantamientos = await levantamiento.findAll();
  
    return {
        statusCode: 200,
        body: JSON.stringify(levantamientos),
    };
};
