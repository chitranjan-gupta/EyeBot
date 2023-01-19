const { workerData, parentPort } = require("node:worker_threads");
let { url, prices } = JSON.parse(workerData);
const cheerio = require("cheerio");
const reqprom = require("request-promise");
//const url = "https://www.flipkart.com/ram-musical-brown-two-set-drum/p/itm74e1137525369";
const time = 60*1000
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

setInterval(() => {
  
},time)