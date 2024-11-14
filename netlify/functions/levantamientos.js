// netlify/functions/levantamientos.js
import { levantamiento } from '../../models/index.js';

exports.handler = async function(event, context) {

    const levantamients = await levantamiento.findAll();
  
    return {
      statusCode: 200,
      body: JSON.stringify(levantamients)
    };
  };
  