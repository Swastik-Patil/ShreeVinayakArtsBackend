const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
require("dotenv").config();
const cors = require("cors");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const axios = require("axios");
const jwt = require("jsonwebtoken");
const authRoutes = require("./routes/auth");
const Purchase = require("./models/Purchase");
const app = express();
const port = process.env.PORT || 5001;
const endpointSecret = process.env.STRIPE_ENDPOINT_SECRET;

app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

mongoose
  .connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    dbName: "ECOMMERCE",
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((error) => console.error("MongoDB connection error:", error));

// Routes
app.use("/auth", authRoutes);

app.post("/getOrders", async (req, res) => {
  const token = req.body.token;
  const decoded = jwt.decode(token);
  const userId = decoded.userId;
  const purchases = await Purchase.find({ userId });
  res.status(200).json({ purchases });
});

let order = [];
let token = [];
let index = 0;
app.post("/purchase", async (req, res) => {
  let total = 0;
  let productIDs = [];
  req.body.items.forEach((item) => {
    total = total + item.price * 100 * item.quantity;
    productIDs.push(item.id);
  });
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: req.body.items.map((item) => {
        return {
          price_data: {
            currency: "inr",
            product_data: {
              name: item.title,
            },
            unit_amount: item.price * 100,
          },
          quantity: item.quantity,
        };
      }),
      success_url: `${process.env.CLIENT_URL}/order/success`,
      cancel_url: `${process.env.CLIENT_URL}/order/cancel`,
    });

    let id = session.id;
    let items = req.body.items;
    order.push({ id, items });
    token.push(req.body.token);

    res.json({ url: session.url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Stripe After payment
// Set up a webhook endpoint to listen for successful payment events
app.post("/webhook", (request, response) => {
  const payloadString = JSON.stringify(request.body, null, 2);
  let secret = endpointSecret;
  let header = stripe.webhooks.generateTestHeaderString({
    payload: payloadString,
    secret,
  });
  let event = stripe.webhooks.constructEvent(payloadString, header, secret);
  let success = false;
  switch (event.type) {
    case "charge.succeeded":
      storeOrderData(
        request.body.id,
        request.body.data.object.receipt_url,
        request.body.data.object.payment_method,
        request.body.data.object.amount
      );
      success = true;
      break;
    case "payment_intent.canceled":
      const paymentIntentCanceled = event.data.object;
      break;
    case "payment_intent.payment_failed":
      const paymentIntentPaymentFailed = event.data.object;
      success = false;
      break;
    case "checkout.session.completed":
      const checkoutSessionCompleted = event.data.object;
      break;
    default:
      break;
  }

  response.send({ isSuccess: success });
});

async function storeOrderData(id, receipt, mode, amount) {
  amount = amount / 100;
  let decoded = jwt.decode(token[index]);
  let userId = decoded.userId;
  let orderItems = JSON.stringify(order[index].items);
  let date = new Date().toDateString();
  try {
    const newData = [
      {
        userId: userId,
        orderId: id,
        orderItems: orderItems,
        amount: amount,
        receipt: receipt,
        mode: mode,
        date: date,
      },
    ];

    const result = await Purchase.insertMany(newData);
    index += 1;
    if (result.writeErrors && result.writeErrors.length > 0) {
      console.error("Failed to add data:", result.writeErrors);
    } else {
      console.log("Data added to the purchases collection");
    }
  } catch (error) {
    console.error("Failed to add data:", error);
  }
}

// Authentication
app.post("/check-login", async (req, res) => {
  const token = req.body.token;
  if (token) {
    try {
      const decoded = jwt.decode(token);
      const userId = decoded.userId;
      if (userId === "") {
        res
          .status(401)
          .json({ message: "Invalid User, Please Log In", isTrue: false });
      } else {
        res.status(200).json({ isTrue: true });
      }
    } catch (error) {
      res.status(401).json({ isTrue: false });
    }
  } else {
    res.status(401).json({ isTrue: false });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});
