const cluster = require('node:cluster');
const numCPUs = require('node:os').cpus().length;
const process = require('node:process');
const app = require("./index.js")

if (cluster.isPrimary) {
  console.log(`Primary ${process.pid} is running`);
  // Fork workers.
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`worker ${worker.process.pid} died`);
  });
} else {
  app.listen(process.env.PORT, () => {
    console.log("Started Server");
  });
}