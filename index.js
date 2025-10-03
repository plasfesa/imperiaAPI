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
require('dotenv').config();  // Importante para leer el .env

const { poolPromise } = require("./db");

const app = express();
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

//const hostname = 'plasfesa.ddns.net';
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
