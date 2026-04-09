const http = require("http");
const { Connection, Request: TdsRequest } = require("tedious");

const PORT = process.env.PORT || 3000;
const PROXY_SECRET = process.env.PROXY_SECRET || "";

function runQuery(config, query) {
  return new Promise((resolve, reject) => {
    const rows = [];
    const connection = new Connection({
      server: config.host,
      authentication: {
        type: "default",
        options: {
          userName: config.user,
          password: config.password,
        },
      },
      options: {
        database: config.database,
        encrypt: true,
        trustServerCertificate: false,
        connectTimeout: 30000,
        requestTimeout: 30000,
      },
    });

    connection.on("connect", (err) => {
      if (err) return reject(err);
      const request = new TdsRequest(query, (err, rowCount) => {
        if (err) return reject(err);
        connection.close();
        resolve(rows);
      });
      request.on("row", (columns) => {
        const row = {};
        columns.forEach((col) => (row[col.metadata.colName] = col.value));
        rows.push(row);
      });
      connection.execSql(request);
    });

    connection.connect();
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
    });
    return res.end();
  }

  if (req.method !== "POST") {
    res.writeHead(405);
    return res.end(JSON.stringify({ error: "Method not allowed" }));
  }

  if (PROXY_SECRET) {
    const auth = req.headers["authorization"] || "";
    if (auth !== `Bearer ${PROXY_SECRET}`) {
      res.writeHead(401);
      return res.end(JSON.stringify({ error: "Unauthorized" }));
    }
  }

  try {
    const body = await new Promise((resolve) => {
      let data = "";
      req.on("data", (chunk) => (data += chunk));
      req.on("end", () => resolve(JSON.parse(data)));
    });

    const { host, database, user, password, query } = body;
    if (!host || !database || !user || !password || !query) {
      res.writeHead(400);
      return res.end(JSON.stringify({ error: "Missing fields: host, database, user, password, query" }));
    }

    const rows = await runQuery({ host, database, user, password }, query);
    res.writeHead(200);
    res.end(JSON.stringify({ success: true, rowCount: rows.length, rows }));
  } catch (err) {
    res.writeHead(500);
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
});

server.listen(PORT, () => {
  console.log(`Fabric proxy running on port ${PORT}`);
});
