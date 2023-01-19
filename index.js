const worker = require("node:worker_threads");
const mongoose = require("mongoose");
const express = require("express");
const axios = require("axios");
const app = express();

const BOT_TOKEN = process.env["BOT_TOKEN"];
// Token used by telegram to authorize the use of a bot; replace with your token
// Connect to MongoDB
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

function log(text) { console.log(text); } //Logging

async function getUser(username) {
  try {
    return await User.findOne({ username: username });
  } catch (err) {
    log(err);
    return 0;
  }
}

function checkPrice(url,prices) {
  const worker = new Worker("./worker.js",{ workerData: JSON.stringify({url:url,prices:prices})});
  worker.on("message",(val) => {log(val)});
  worker.on("error",(err) => {log(err)});
};

app.use(express.json());
app.get("/", (req, res) => {
  log(req.headers["x-forwarded-for"]);
  res.status(200).send("ok");
})
app.post("/", async (req, res) => {
  //log(req.rawHeaders);
  //log(req.body.message.text);
  res.status(200).send("ok");
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
            
            //checkPrice(URL);
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
            const productDetail = `${i + 1}. ${product.name ? product.name : "Unknown"} \nLink: ${product.url} \nCurrent Price: ${product.prices[product.length - 1] ? product.prices[product.length - 1] : "Unknown"} \nStatus: ${product.status}\n`;
            await sendMessage(chatId, productDetail);
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
          const pattern = /(?:https?):\/\/(\w+:?\w*)?(\S+)(:\d+)?(\/|\/([\w#!:.?+=&%!\-\/]))?/;
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
})
app.listen(process.env.PORT, () => {
  log("Started Server");
});
//https://api.telegram.org/bot[botToken]/setWebhook?url=[url]&drop_pending_updates=true
//https://api.telegram.org/bot[botToken]/sendMessage?chat_id=[intger or string]&text=[string]