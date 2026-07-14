const axios = require("axios");
require("dotenv").config();

const SCP_BASE_URL = process.env.SCP_BASE_URL || "https://scp.imperiascm.com";

// Llama al endpoint de autenticación de SCP y devuelve el access_token
async function authenticateSCP() {
  const url = `${SCP_BASE_URL}/api/authentication/authenticate`;
  console.log("[authenticateSCP] URL:", url);
  console.log("[authenticateSCP] SCP_EMAIL:", process.env.SCP_EMAIL);
  console.log("[authenticateSCP] SCP_PASSWORD definida:", !!process.env.SCP_PASSWORD);

  let response;
  try {
    response = await axios.post(
      url,
      {
        Email: process.env.SCP_EMAIL,
        Password: process.env.SCP_PASSWORD,
      },
      { timeout: 15000 }
    );
  } catch (err) {
    console.error("[authenticateSCP] axios.post falló:", err.message);
    console.error("[authenticateSCP] err.response?.status:", err.response?.status);
    console.error("[authenticateSCP] err.response?.data:", err.response?.data);
    throw err;
  }

  console.log("[authenticateSCP] status:", response.status);
  console.log("[authenticateSCP] data:", JSON.stringify(response.data));

  const { data } = response;
  if (!data || !data.Token) {
    throw new Error("La respuesta de SCP no contiene Token");
  }

  return data.Token;
}

// Llama al endpoint de exportación de previsiones de SCP usando el access_token del paso 1
async function getDatasourceData(accessToken, { idConfiguration = 1, page = 1, size = -1 } = {}) {
  const url = `${SCP_BASE_URL}/api/data-export/get-datasource-data`;
  const body = {
    IdConfiguration: idConfiguration,
    Pagination: { Page: page, Size: size },
  };
  console.log("[getDatasourceData] URL:", url);
  console.log("[getDatasourceData] body:", JSON.stringify(body));

  let response;
  try {
    response = await axios.post(url, body, {
      timeout: 15000,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (err) {
    console.error("[getDatasourceData] axios.post falló:", err.message);
    console.error("[getDatasourceData] err.response?.status:", err.response?.status);
    console.error("[getDatasourceData] err.response?.data:", err.response?.data);
    throw err;
  }

  console.log("[getDatasourceData] status:", response.status);

  return response.data;
}

module.exports = { authenticateSCP, getDatasourceData };
