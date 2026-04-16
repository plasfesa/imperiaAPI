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

const app = express();
// Aumenta el límite, por ejemplo a 10 MB
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));


app.use(express.json());

// Middleware para validar api_key
app.use((req, res, next) => {  
  const apiKey = req.query.api_key || req.headers['x-api-key']; 
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: "No autorizado: API Key inválida" });
  }
  next();
});

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



// POST - addForecast
app.post("/addForecast", async (req, res) => {
  // Puede venir un objeto o un array; lo normalizamos a array
  const forecasts = Array.isArray(req.body) ? req.body : [req.body];

  if (!forecasts || forecasts.length === 0) {
    return res.status(400).json({
      error: "Debe enviar al menos una previsión en el cuerpo de la petición",
    });
  }

  let transaction;

  try {
    const pool = await poolPromise;
    // Vamos insertando cada previsión
    for (const f of forecasts) {
      console.log(f);
      const { itemCode, cliente, quantity, dayCode, Valor, Concepto } = f;

      // Validación básica
      if (
        itemCode === undefined ||
        cliente === undefined ||
        quantity === undefined ||
        dayCode === undefined  ||
        Valor === undefined
      ) {
        throw new Error(
          "Cada previsión debe incluir itemCode, cliente, quantity, dayCode y Valor"
        );
      }

      const request = pool.request();
      request.input("itemCode", sql.VarChar, itemCode);
      request.input("cliente", sql.VarChar, cliente);
      request.input("quantity", sql.Float, quantity);
      request.input("dayCode", sql.Int, dayCode);
      request.input("Valor", sql.Float, Valor);
      request.input("Concepto", sql.VarChar, Concepto);

      const query = `
        INSERT INTO pers_previsiones_imperia (idArticulo, idCliente, cantidad, fecha, importe, tipo)
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
          @Concepto
        );
      `;

      await request.query(query);
    }

   // await transaction.commit();

    res.status(201).json({
      message: "Previsiones insertadas correctamente",
      count: forecasts.length,
    });
  } catch (err) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (_) {
        // ignoramos errores de rollback
      }
    }
    res
      .status(500)
      .send("Error al insertar previsiones: " + err.message);
  }
});

// POST - deleteForecast
app.delete("/delete", async (req, res) => {
  let transaction;

  try {
    const pool = await poolPromise;
    // Elimina todas las previsiones
     const request = pool.request();

    await request.query(`
      DELETE FROM pers_previsiones_imperia;
    `);

    res.status(200).json({
      message: "Todas las previsiones han sido eliminadas correctamente"
    });

  } catch (err) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (_) {}
    }

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






// ****************[FIN] PRODUCCIÓN **********************


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



