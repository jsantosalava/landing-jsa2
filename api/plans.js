const ALLOWED_TYPES = new Set(["invoicing", "store"]);

module.exports = async function handler(request, response) {
  const type = String(request.query.type || "").trim().toLowerCase();

  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=3600");

  if (!ALLOWED_TYPES.has(type)) {
    response.status(400).json({
      error: "Tipo de plan no permitido.",
      allowed_types: Array.from(ALLOWED_TYPES),
    });
    return;
  }

  const endpoint = `https://api.ecfactura.com/api/v1/public/plans?type=${encodeURIComponent(type)}`;

  try {
    const apiResponse = await fetch(endpoint, {
      headers: {
        Accept: "application/json",
        "User-Agent": "JSA Landing Plans Proxy",
      },
    });

    const body = await apiResponse.text();

    if (!apiResponse.ok) {
      response.status(apiResponse.status).json({
        error: `EcFactura respondio con estado HTTP ${apiResponse.status}.`,
      });
      return;
    }

    JSON.parse(body);
    response.status(200).send(body);
  } catch (error) {
    response.status(502).json({
      error: "No se pudo conectar con EcFactura.",
    });
  }
};
