const { Worker } = require("node:worker_threads");
const mongoose = require("mongoose");
const express = require("express");
const axios = require("axios");
const app = express();
const pattern = /(?:https?):\/\/(\w+:?\w*)?(\S+)(:\d+)?(\/|\/([\w#!:.?+=&%!\-\/]))?/;
app.set("view engine", "ejs");
//Set the view engine to ejs

function log(text) { console.log(text); } //Logging

const BOT_TOKEN = process.env["BOT_TOKEN"];
// Token used by telegram to authorize the use of a bot; replace with your token
// Connect to MongoDB
mongoose.set('strictQuery', true);
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});
// Product Schema
const productSchema = mongoose.Schema({
  name: String,
  url: String,
  status: { type: Boolean, default: false },
  prices: [Number],
  time: { type: Number, default: 3600 }
});
// User model
const User = mongoose.model("User", {
  username: String,
  first_name: String,
  last_name: String,
  tid: Number,
  status: { type: Boolean, default: false },
  products: [productSchema]
});

const sendMessage = async (chatId, message) => {
  await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(message)}`);
};

async function getUser(username) {
  try {
    return await User.findOne({ username: username });
  } catch (err) {
    log(err);
    return 0;
  }
}
let workerMap = new Map();
function checkPrice(username, url, prices) {
  if(!workerMap.has(url)){
    const warkar = new Worker("./worker.js", { workerData: JSON.stringify({ username: username, url: url, prices: prices }) });
    warkar.on("message", function(val) {
      let { username, url, price } = JSON.parse(val);
      User.updateOne({ username: username, "products.url": url }, { $push: { "products.$.prices": price }, $set: { "products.$.status": true } }).exec();
    });
    warkar.on("error", (err) => { log(err) });
    workerMap.set(url,warkar);
  }
};
async function startPrice(username,url){
  const data = await getUser(username);
  if (data) {
    User.findOneAndUpdate({ username: data.username }, { status: true }).exec();
    for (let i = 0; i < data.products.length; i++) {
      if(data.products[i].url == url){
        checkPrice(data.username, data.products[i].url, data.products[i].prices ? data.products[i].prices : [-1]);
      }
    }
  }
}
function stopPrice(username,url){
  if(workerMap.has(url)){
    workerMap.get(url).postMessage("exit");
    workerMap.delete(url);
    User.updateOne({ username: username, "products.url": url }, { $set: { "products.$.status": false } }).exec();
    if(workerMap.size === 0){
      User.findOneAndUpdate({ username: username }, { status: false }).exec();
    }
  }
}
function deletePrice(username,url){
  stopPrice(username,url);
  User.updateOne({ username: username }, { $pull: { "products": { "url": url } } }).exec();
}
app.use(express.json());
app.get("/", async (req, res) => {
  log(req.headers["x-forwarded-for"]);
  if (process.env["WEBHOOK_URL"]) {
    if (process.env["WEBHOOK_URL"].match(pattern)[0]) {
      const result = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
      const link = result.data.result.url.toString();
      if (link) {
        if(process.env["WEBHOOK_URL"] != link){
          await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${process.env["WEBHOOK_URL"]}&drop_pending_updates=true`);
        }
      }
    }
  }
  res.render("pages/index");
})
app.post("/", async (req, res) => {
  res.status(200).send("ok");
  if(req.body.callback_query){
    const cmes = req.body.callback_query;
    const link = cmes.message.text.match(/Link: (https?:\/\/\S+)/)?.[1] || false;
    const username = cmes.from.username;
    let mes = "Working on it";
    if(cmes.data){
      switch(cmes.data){
        case "start":{
          startPrice(username,link).then((v) => {});
          mes = "Started Tracking";
          break;
        }
        case "stop":{
          stopPrice(username,link);
          mes = "Stopped Tracking";
          break;
        }
        case "delete":{
          deletePrice(username,link);
          mes = "Deleted the product from list";
          break;
        }
        case "5000":{
          break;
        }
        case "60000":{
          break;
        }
        case "3600000":{
          break;
        }
        case "86400000":{
          break;
        }
      }
    }
    await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery?callback_query_id=${cmes.id}&text=${encodeURIComponent(mes)}&show_alert=${true.toString()}`);
  }else if(req.body.message){
    switch (req.body.message.text) {
      case "/start":
        {
          const chatId = req.body.message.chat.id;
          const message = "Hi! " + req.body.message.chat.first_name +
            "\nWelcome You to Flipkart Product Price Tracker Bot." +
            " You can track the price of Flipkart Product by sending the link.";
          await sendMessage(chatId, message);
          const data = await getUser(req.body.message.from.username);
          if (!data) {
            let user = new User({
              username: req.body.message.from.username,
              first_name: req.body.message.from.first_name,
              last_name: req.body.message.from.last_name,
              tid: req.body.message.from.id
            });
            await user.save();
          }
          break;
        }
      case "/tstart":
        {
          const chatId = req.body.message.chat.id;
          const data = await getUser(req.body.message.from.username);
          if (data) {
            if (data.status === false) {
              await User.findOneAndUpdate({ username: data.username }, { status: true })
              const message = "Started Tracking...";
              await sendMessage(chatId, message);
              //Start Tracking
              for (let i = 0; i < data.products.length; i++) {
                checkPrice(data.username, data.products[i].url, data.products[i].prices ? data.products[i].prices : [-1]);
              }
            } else {
              const message = "Tracking is already running.";
              await sendMessage(chatId, message);
            }
          }
          break;
        }
      case "/tstop":
        {
          const chatId = req.body.message.chat.id;
          const data = await getUser(req.body.message.from.username);
          if (data) {
            if (data.status === true) {
              await User.findOneAndUpdate({ username: data.username }, { status: false });
              const message = "Stopped Tracking...";
              await sendMessage(chatId, message);
              //Stop Tracking
              for (const [key, value] of workerMap) {
                value.postMessage("exit");
              }
            } else {
              const message = "Tracking is already stopped.";
              await sendMessage(chatId, message);
            }
          }
          break;
        }
      case "/list":
        {
          const chatId = req.body.message.chat.id;
          const data = await getUser(req.body.message.from.username);
          if (data) {
            const message = "List of products you have added for tracking:";
            await sendMessage(chatId, message);
            for (let i = 0; i < data.products.length; i++) {
              const product = data.products[i];
              const productDetail = `${i + 1}. ${product.name ? product.name : "Unknown"} \nLink: ${product.url} \nCurrent Price: ${product.prices[product.prices.length - 1] ? "₹" + product.prices[product.prices.length - 1] : "Unknown"} \nStatus: ${product.status}\n`;
              const productStatus = product.status?"Stop":"Start";
              const payload = {
                inline_keyboard:[
                  [
                    { text:productStatus, callback_data:productStatus.toLowerCase() },
                    { text:"Delete", callback_data:"delete" }
                  ],
                  [
                    { text:"5S", callback_data:"5000" },
                    { text:"1M", callback_data:"60000" },
                    { text:"1H", callback_data:"3600000" },
                    { text:"1D", callback_data:"86400000" },
                  ]
                ]
              };
              await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(productDetail)}&reply_markup=${encodeURIComponent(JSON.stringify(payload))}`);
            }
          } else {
            const message = "You haven't added any product.";
            await sendMessage(chatId, message);
          }
          break;
        }
      case "/help":
        {
          const chatId = req.body.message.chat.id;
          const message = "Type /start to Interact with the bot.";
          await sendMessage(chatId, message);
          break;
        }
      default:
        {
          if (req.body.message.text.includes("https://")) {
            const URL = req.body.message.text.match(pattern)[0];
            const chatId = req.body.message.chat.id;
            const message = "Link is Added to tracking.\n To Start Tracking send command " +
              "/tstart and to Stop Tracking send command /tstop";
            await sendMessage(chatId, message);
            const data = await getUser(req.body.message.from.username);
            if (data) {
              await User.findOneAndUpdate({ username: data.username }, { $push: { products: { url: URL } } });
            } else {
              let user = new User({
                username: req.body.message.from.username,
                first_name: req.body.message.from.first_name,
                last_name: req.body.message.from.last_name,
                tid: req.body.message.from.id,
                products: [{ url: URL }]
              });
              await user.save();
            }
          }
          break;
        }
    }
  }
})
if(process.env["BUILD"] === "Production"){
  app.listen(process.env.PORT, () => {
    log("Started Server");
  });
}
module.exports = app;