const { workerData, parentPort } = require("node:worker_threads");
let { username, url, prices } = JSON.parse(workerData);
const cheerio = require("cheerio");
const reqprom = require("request-promise");
//const url = "https://www.flipkart.com/ram-musical-brown-two-set-drum/p/itm74e1137525369";
const time = 60 * 1000;
if (prices.length < 1) {
  prices.push(0);
}
let intervalId;
parentPort.on("message", function(data) {
  if (data == "exit") {
    clearInterval(intervalId);
    process.exit();
  }
})
async function getPrice(url) {
  try {
    const html = await reqprom(url);
    if (html) {
      const $ = cheerio.load(html);
      const el = $("._30jeq3._16Jk6d");
      const p = parseFloat(el.text().replace("₹", ""));
      return p;
    } else {
      return 0;
    }
  } catch (err) {
    console.log(err);
    return 0;
  }
}
async function check() {
  const price = await getPrice(url);
  console.log(prices);
  if (price > prices[prices.length - 1]) {
    prices.push(price);
    parentPort.postMessage(JSON.stringify({ username: username, url: url, price: price }));
  }
}
check();
intervalId = setInterval(check, time);