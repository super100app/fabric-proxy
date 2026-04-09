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
        type: "azure-active-directory-password",
        options: {
          userName: config.user,
          password: config.password,
        },
      },
      options: {
        database: config.database,
        encrypt: true,
        port: 1433,
        connectTimeout: 30000,
        requestTimeout: 60000,
      },
    });

    connection.on("connect", (err) => {
      if (err) return reject(err);

      const request = new TdsRequest(query, (err, rowCount) => {
        connection.close();
        if (err) return reject(err);
        resolve(rows);
      });

      request.on("row", (columns) => {
        const row = {};
        columns.forEach((col) => {
          row[col.metadata.colName] = col.value;
        });
        rows.push(row);
      });

      connection.execSql(request);
    });

    connection.connect();
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    return res.end("ok");
  }

  if (req.method !== "POST") {
    res.writeHead(405);
    return res.end(JSON.stringify({ error: "POST only" }));
  }

  const auth = req.headers["authorization"] || "";
  if (PROXY_SECRET && auth !== `Bearer ${PROXY_SECRET}`) {
    res.writeHead(401);
    return res.end(JSON.stringify({ error: "Unauthorized" }));
  }

  let body = "";
  for await (const chunk of req) body += chunk;

  try {
    const { host, database, user, password, query } = JSON.parse(body);

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
