const express = require('express');
const axios = require('axios');
const soap = require('soap');
var https = require('https');
var http = require('http');
var fs = require('fs');
const { Console } = require('console');
const cluster = require('cluster');
const path = require('path');
const geoip = require('geoip-lite');
const sql = require("mssql");
require('dotenv').config();  // Importante para leer el .env

const { poolPromise } = require("./db");
const { authenticateSCP, getDatasourceData } = require("./scpClient");

const app = express();
// Aumenta el límite, por ejemplo a 10 MB
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));


app.use(express.json());

// Middleware para validar api_key
app.use((req, res, next) => {
  const apiKey = req.query.api_key || req.headers['x-api-key'];
  // console.log(`[api_key middleware] ${req.method} ${req.path} - apiKey recibida:`, apiKey);
  if (!apiKey || apiKey !== process.env.API_KEY) {
    // console.log("[api_key middleware] API Key inválida o ausente -> 401");
    return res.status(401).json({ error: "No autorizado: API Key inválida" });
  }
  // console.log("[api_key middleware] API Key válida -> next()");
  next();
});

// Elimina todas las previsiones (misma lógica que usa el endpoint /delete)
async function deleteAllPrevisiones(pool) {
  await pool.request().query("DELETE FROM pers_previsiones_imperia;");
}

// Valida e inserta previsiones (misma lógica que usa el endpoint /addForecast)
async function insertForecasts(pool, forecasts) {
  for (const f of forecasts) {
    const { itemCode, cliente, quantity, dayCode, Valor } = f;
    const concepto = f.concepto !== undefined ? f.concepto : f.Concepto;
    const FechaFin = f.FechaFin !== undefined ? f.FechaFin : null;

    if (
      itemCode === undefined ||
      cliente === undefined ||
      quantity === undefined ||
      dayCode === undefined ||
      Valor === undefined ||
      concepto === undefined
    ) {
      throw new Error(
        "Cada previsión debe incluir itemCode, cliente, quantity, dayCode, Valor y concepto"
      );
    }

    const request = pool.request();
    request.input("itemCode", sql.VarChar, itemCode);
    request.input("cliente", sql.VarChar, cliente);
    request.input("quantity", sql.Float, quantity);
    request.input("dayCode", sql.Int, dayCode);
    request.input("Valor", sql.Float, Valor);
    request.input("concepto", sql.VarChar, (concepto === null) ? 'Base' : concepto);
    request.input("FechaFin", sql.DateTime, FechaFin);

    const query = `
      INSERT INTO pers_previsiones_imperia (idArticulo, idCliente, cantidad, fecha, importe, tipo, fechaFinPrevisiones)
      VALUES (
        @itemCode,
        @cliente,
        @quantity,
        DATEADD(
          DAY,
          (@dayCode % 1000) - 1,
          DATEFROMPARTS(@dayCode / 1000, 1, 1)
        ),
        @Valor,
        @concepto,
        @FechaFin
      );
    `;

    await request.query(query);
  }
}

// Extrae el array de previsiones de la respuesta de SCP (formato aún por confirmar)
function extractForecastRecords(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.Data)) return data.Data;
  if (data && Array.isArray(data.Items)) return data.Items;
  if (data && Array.isArray(data.Rows)) return data.Rows;
  if (data && Array.isArray(data.Records)) return data.Records;
  return null;
}

// Ruta principal
app.get("/", (req, res) => {
  res.send("Bienvenido a imperiaAPI");
});

// 01 - mprod
app.get("/mProd", async (req, res) => {
  try {    
    const pool = await poolPromise;
    const result = await pool.request().query("SELECT * FROM vpers_imperia_mprod");
    res.json(result.recordset);
  } catch (err) {
    res.status(500).send("Error en la consulta: " + err.message);
  }
});

// 02 - mclientes
app.get("/mClientes", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query("SELECT * FROM vpers_imperia_mclientes");
    res.json(result.recordset);
  } catch (err) {
    res.status(500).send("Error en la consulta: " + err.message);
  }
});

// 03 - mUbicacionesVenta
app.get("/mUbicacionesVenta", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query("SELECT * FROM vpers_imperia_mUbicacionesVenta");
    res.json(result.recordset);
  } catch (err) {
    res.status(500).send("Error en la consulta: " + err.message);
  }
});

// 04 - histVentas
app.get("/histVentas", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query("SELECT * FROM vpers_imperia_histVentas");
    res.json(result.recordset);
  } catch (err) {
    res.status(500).send("Error en la consulta: " + err.message);
  }
});

// 05 - bom
app.get("/bom", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query("SELECT * FROM vpers_imperia_bom");
    res.json(result.recordset);
  } catch (err) {
    res.status(500).send("Error en la consulta: " + err.message);
  }
});

// 06 - mproveedores
app.get("/mproveedores", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query("SELECT * FROM vpers_imperia_mproveedores");
    res.json(result.recordset);
  } catch (err) {
    res.status(500).send("Error en la consulta: " + err.message);
  }
});

// 07 - mProveedorMaterial
app.get("/mproveedorMaterial", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query("SELECT * FROM vpers_imperia_mproveedor_material");
    res.json(result.recordset);
  } catch (err) {
    res.status(500).send("Error en la consulta: " + err.message);
  }
});


// 08 - mOrdenesCompraAbiertas
app.get("/mordenesCompraAbiertas", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query("SELECT * FROM vpers_imperia_mordenes_compra_abiertas");
    res.json(result.recordset);
  } catch (err) {
    res.status(500).send("Error en la consulta: " + err.message);
  }
});


// POST - addForecast
app.post("/addForecast", async (req, res) => {
  // Puede venir un objeto o un array; lo normalizamos a array
  const forecasts = Array.isArray(req.body) ? req.body : [req.body];

  if (!forecasts || forecasts.length === 0) {
    return res.status(400).json({
      error: "Debe enviar al menos una previsión en el cuerpo de la petición",
    });
  }

  try {
    const pool = await poolPromise;
    await insertForecasts(pool, forecasts);

    res.status(201).json({
      message: "Previsiones insertadas correctamente",
      count: forecasts.length,
    });
  } catch (err) {
    res
      .status(500)
      .send("Error al insertar previsiones: " + err.message);
  }
});

// POST - deleteForecast
app.delete("/delete", async (req, res) => {
  try {
    const pool = await poolPromise;
    await deleteAllPrevisiones(pool);

    res.status(200).json({
      message: "Todas las previsiones han sido eliminadas correctamente"
    });
  } catch (err) {
    res.status(500).send("Error al eliminar previsiones: " + err.message);
  }
});

// ********************************************************
// ********************** PRODUCCIÓN **********************
// ********************************************************


// Stock
app.get("/produccion/stock", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query("SELECT * FROM vpers_imperia_produccion_stock");
    res.json(result.recordset);
  } catch (err) {
    res.status(500).send("Error en la consulta: " + err.message);
  }
});


// Configuración de proceso
app.get("/produccion/configuracionProceso", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query("SELECT * FROM vpers_imperia_produccion_configuracionProceso");
    res.json(result.recordset);
  } catch (err) {
    res.status(500).send("Error en la consulta: " + err.message);
  }
});

// Órdenes de producción
app.get("/produccion/ordenesProduccion", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query("SELECT * FROM vpers_imperia_produccion_ordenesProduccion");
    res.json(result.recordset);
  } catch (err) {
    res.status(500).send("Error en la consulta: " + err.message);
  }
});


// Lineas de producción
app.get("/produccion/lineasProduccion", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query("SELECT * FROM vpers_imperia_produccion_lineasProduccion");
    res.json(result.recordset);
  } catch (err) {
    res.status(500).send("Error en la consulta: " + err.message);
  }
});


// Calenda de Lineas de producción
app.get("/produccion/calendarioLineasProduccion", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query("SELECT * FROM vpers_imperia_produccion_calendarioLineasProduccion");
    res.json(result.recordset);
  } catch (err) {
    res.status(500).send("Error en la consulta: " + err.message);
  }
});




// ****************[FIN] PRODUCCIÓN **********************


// Elimina todas las previsiones (misma lógica que usa el endpoint /delete)
async function deleteAllArticulosSustitutos(pool) {
  await pool.request().query("DELETE FROM pers_articulos_sustitutos;");
}

// Elimina todas las previsiones (misma lógica que usa el endpoint /delete)
async function updateForecastFechaFinPrevisiones(pool) {
  await pool.request().query("execute pers_sp_previsiones_imperia_actualiza_fechaFinPrevisiones;");
}

// Valida e inserta previsiones (misma lógica que usa el endpoint /addForecast)
async function insertArticulosSustitutos(pool, articulosSustitutos) {
  for (const f of articulosSustitutos) {
    const { CodigoAntiguo, CodigoSustituto, Multiplicador, FechaSustitucion } = f;

    if (
      CodigoAntiguo === undefined ||
      CodigoSustituto === undefined ||
      Multiplicador === undefined
    ) {
      throw new Error(
        "Cada artículo sustituto debe incluir CodigoAntiguo, CodigoSustituto y Multiplicador"
      );
    }

    const request = pool.request();
    request.input("idArticuloAntiguo", sql.VarChar, CodigoAntiguo);
    request.input("idArticuloNuevo", sql.VarChar, CodigoSustituto);
    request.input("multiplicador", sql.Float, Multiplicador);
    request.input("fechaSustitucion", sql.DateTime, FechaSustitucion ?? new Date());

    const query = `
      INSERT INTO pers_articulos_sustitutos (idArticuloAntiguo, idArticuloNuevo, multiplicador, fechaSustitucion)
      VALUES (
        @idArticuloAntiguo,
        @idArticuloNuevo,
        @multiplicador,
        @fechaSustitucion
      );
    `;

    await request.query(query);
  }
}




// ********************************************************
// ************************** SCP **************************
// ********************************************************

// POST - Autenticación contra SCP (devuelve el access_token)
app.post("/scp/authenticate", async (req, res) => {
  try {
    // console.log("[/scp/authenticate] Llamando a authenticateSCP()...");
    const accessToken = await authenticateSCP();
    // console.log("[/scp/authenticate] authenticateSCP() OK, token length:", accessToken?.length);
    if (res.headersSent) {
      // console.log("[/scp/authenticate] headersSent ya era true, no respondo de nuevo");
      return;
    }
    res.json({ access_token: accessToken });
    // console.log("[/scp/authenticate] Respuesta enviada al cliente");
  } catch (err) {
    console.error("[/scp/authenticate] Error al autenticar con SCP:", err);
    if (res.headersSent) {
      // console.log("[/scp/authenticate] headersSent ya era true en catch, no respondo de nuevo");
      return;
    }
    const detail = err.response?.data || err.message;
    res.status(502).json({ error: "Error al autenticar con SCP", detail });
  }
});



// POST - Job SCP: autentica y exporta las previsiones (datasource) desde SCP
app.post("/scp/previsiones", async (req, res) => {
  // console.log("[/scp/previsiones] Petición recibida");
  try {
    // console.log("[/scp/previsiones] Llamando a authenticateSCP()...");
    const accessToken = await authenticateSCP();
    // console.log("[/scp/previsiones] authenticateSCP() OK, token length:", accessToken?.length);

    // console.log("[/scp/previsiones] Llamando a getDatasourceData()...");
    const data = await getDatasourceData(accessToken, { idConfiguration: 1, page: 1, size: -1 });
    // console.log("[/scp/previsiones] getDatasourceData() OK");

    if (data && (data.Error === true || (data.ErrorCode !== undefined && data.ErrorCode !== 0))) {
      // console.error("[/scp/previsiones] SCP devolvió error:", JSON.stringify(data));
      if (res.headersSent) return;
      return res.status(502).json({
        error: "SCP devolvió un error al exportar las previsiones",
        data,
      });
    }

    const forecasts = extractForecastRecords(data);
    if (!forecasts) {
      // console.error("[/scp/previsiones] Respuesta de SCP no reconocida:", JSON.stringify(data));
      if (res.headersSent) return;
      return res.status(502).json({
        error: "SCP no devolvió previsiones en un formato reconocido",
        data,
      });
    }
    // console.log("[/scp/previsiones] Previsiones recibidas:", forecasts.length);

    const pool = await poolPromise;

    // console.log("[/scp/previsiones] Datos recibidos correctamente, borrando previsiones existentes...");
    await deleteAllPrevisiones(pool);
    // console.log("[/scp/previsiones] Previsiones existentes borradas, insertando las nuevas...");

    await insertForecasts(pool, forecasts);
    // console.log("[/scp/previsiones] Previsiones insertadas:", forecasts.length);
    await updateForecastFechaFinPrevisiones(pool);

    if (res.headersSent) {
      // console.log("[/scp/previsiones] headersSent ya era true, no respondo de nuevo");
      return;
    }
    res.json({
      message: "Previsiones sincronizadas desde SCP correctamente",
      count: forecasts.length,
    });
    // console.log("[/scp/previsiones] Respuesta enviada al cliente");
  } catch (err) {
    // console.error("[/scp/previsiones] Error en el job de SCP:", err);
    if (res.headersSent) {
      // console.log("[/scp/previsiones] headersSent ya era true en catch, no respondo de nuevo");
      return;
    }
    const detail = err.response?.data || err.message;
    res.status(502).json({ error: "Error al exportar previsiones de SCP", detail });
  }
});



// POST - Job SCP: autentica y exporta las previsiones (datasource) desde SCP
app.post("/scp/articulosSustitutos", async (req, res) => {
  // console.log("[/scp/articulosSustitutos] Petición recibida");
  try {
    // console.log("[/scp/articulosSustitutos] Llamando a authenticateSCP()...");
    const accessToken = await authenticateSCP();
    // console.log("[/scp/articulosSustitutos] authenticateSCP() OK, token length:", accessToken?.length);

    // console.log("[/scp/articulosSustitutos] Llamando a getDatasourceData()...");
    const data = await getDatasourceData(accessToken, { idConfiguration: 22, page: 1, size: -1 });
    // console.log("[/scp/articulosSustitutos] getDatasourceData() OK");

    if (data && (data.Error === true || (data.ErrorCode !== undefined && data.ErrorCode !== 0))) {
      // console.error("[/scp/articulosSustitutos] SCP devolvió error:", JSON.stringify(data));
      if (res.headersSent) return;
      return res.status(502).json({
        error: "SCP devolvió un error al exportar los artículos sustitutos",
        data,
      });
    }

    const articulosSustitutos = extractForecastRecords(data);
    if (!articulosSustitutos) {
       // console.error("[/scp/articulosSustitutos] Respuesta de SCP no reconocida:", JSON.stringify(data));
       if (res.headersSent) return;
       return res.status(502).json({
         error: "SCP no devolvió artículos sustitutos en un formato reconocido",
         data,
       });
    }
    // console.log("[/scp/articulosSustitutos] Artículos sustitutos recibidos:", articulosSustitutos.length);
    // console.log("[/scp/articulosSustitutos] Artículos sustitutos:", articulosSustitutos);

    const pool = await poolPromise;

    // console.log("[/scp/articulosSustitutos] Datos recibidos correctamente, borrando artículos sustitutos existentes...");
    await deleteAllArticulosSustitutos(pool);
    // console.log("[/scp/articulosSustitutos] Artículos sustitutos existentes borrados, insertando los nuevos...");

    await insertArticulosSustitutos(pool, articulosSustitutos);
    // console.log("[/scp/articulosSustitutos] Artículos sustitutos insertados:", articulosSustitutos.length);

    if (res.headersSent) {
      // console.log("[/scp/articulosSustitutos] headersSent ya era true, no respondo de nuevo");
      return;
    }
    res.json({
      message: "Artículos sustitutos sincronizados desde SCP correctamente",
      //count: forecasts.length,
    });

    // // console.log("[/scp/articulosSustitutos] Respuesta enviada al cliente");
  } catch (err) {
    // console.error("[/scp/articulosSustitutos] Error en el job de SCP:", err);
    if (res.headersSent) {
      // console.log("[/scp/articulosSustitutos] headersSent ya era true en catch, no respondo de nuevo");
      return;
    }
    const detail = err.response?.data || err.message;
    res.status(502).json({ error: "Error al exportar artículos sustitutos de SCP", detail });
  }
});

// ****************[FIN] SCP ******************************

// POST - Inserta OFs en el ERP
app.post("/addOf", async (req, res) => {
  try {
    // Puede venir un objeto o un array; lo normalizamos a array
  const ofs = Array.isArray(req.body) ? req.body : [req.body];

  if (!ofs || ofs.length === 0) {
    return res.status(400).json({
      error: "Debe enviar al menos un OF en el cuerpo de la petición",
    });
  }

  try {
    const pool = await poolPromise;
    //await insertOFs(pool, ofs);

    res.status(201).json({
      message: "OFs insertados correctamente",
      count: ofs.length,
    });
  } catch (err) {
    res
      .status(500)
      .send("Error al insertar OFs: " + err.message);
  }
    
  } catch (err) {
    if (res.headersSent) {
      return;
    }
    const detail = err.response?.data || err.message;
    res.status(502).json({ error: "Error insertar OF", detail });
  }
});





const hostname = process.env.HOSTNAME;
const httpsPort = process.env.PORT;
const httpsOptions = {
  cert: fs.readFileSync('./certi/plasfesa_ddns_net.pem'),
  key: fs.readFileSync('./certi/private.key')
};

const httpsServer = https.createServer(httpsOptions, app);

httpsServer.listen(httpsPort, hostname, () => {
  console.log(`Servidor HTTPS corriendo en https://${hostname}:${httpsPort}`);
});



