const express = require("express");
const { poolPromise } = require("./db");

const app = express();
app.use(express.json());

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


// Iniciar servidor
const PORT = process.env.PORT || 9000;
app.listen(PORT, () => console.log(`🚀 imperiaAPI corriendo en http://localhost:${PORT}`));
