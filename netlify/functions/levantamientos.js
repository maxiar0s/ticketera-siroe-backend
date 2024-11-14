// netlify/functions/levantamientos.js

export async function handler(event, context) {
    const { levantamiento } = require('../../models/index.js');
    const levantamients = await levantamiento.findAll();
  
    return {
      statusCode: 200,
      body: JSON.stringify(levantamients)
    };
}
  