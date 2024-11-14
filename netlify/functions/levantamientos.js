// netlify/functions/levantamientos.mjs
// import { levantamiento } from '../../models/index.js';
import fetch from 'node-fetch';

export async function handler(event, context) {
    const levantamientos = await levantamiento.findAll();

    return {
        statusCode: 200,
        body: JSON.stringify(levantamientos),
    };
}
