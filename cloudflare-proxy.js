
const http = require("http");
const net = require("net");

const PORT = 9000;

const server = http.createServer((req, res) => {
  const upstream = http.request({
    hostname: "127.0.0.1",
    port: 80,
    path: req.url,
    method: req.method,
    headers: req.headers
  }, (response) => {
    res.writeHead(response.statusCode, response.headers);
    response.pipe(res);
  });

  upstream.on("error", (err) => {
    console.error("HTTP proxy error:", err.message);
    if (!res.headersSent) res.writeHead(502);
    res.end();
  });

  req.pipe(upstream);
});

server.on("upgrade", (req, socket, head) => {
  const match = req.url.match(/^\/game\/(8080|8496)(\/.*)$/);

  if (!match) {
    socket.end("HTTP/1.1 404 Not Found\r\n\r\n");
    return;
  }

  const targetPort = Number(match[1]);
  const targetPath = match[2];

  const upstream = net.connect(targetPort, "127.0.0.1", () => {
    const headers = [];

    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      headers.push(req.rawHeaders[i] + ": " + req.rawHeaders[i + 1]);
    }

    upstream.write(
      `${req.method} ${targetPath} HTTP/1.1\r\n` +
      headers.join("\r\n") +
      "\r\n\r\n"
    );

    if (head.length) upstream.write(head);

    socket.pipe(upstream);
    upstream.pipe(socket);
  });

  upstream.on("error", (err) => {
    console.error("WS proxy error:", err.message);
    socket.destroy();
  });

  socket.on("error", () => upstream.destroy());
  socket.on("close", () => upstream.destroy());
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("KKuTu proxy ready: http://127.0.0.1:" + PORT);
});
