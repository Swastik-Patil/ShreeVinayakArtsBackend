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

    if ((await session.url) != `${process.env.CLIENT_URL}/cancel.html`) {
      let id = session.id;
      total = total / 100;
      let items = req.body.items;
      let order = { id, items, total };
      storeOrderData(order, req.body.token);
    }

    res.json({ url: session.url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Store data after successful Stripe transactions
async function storeOrderData(req, token) {
  let orderNumber = req.orderNumber;
  let amount = req.total;
  let decoded = jwt.decode(token);
  let userId = decoded.userId;
  let orderItems = JSON.stringify(req.items);
  let date = new Date().toDateString();
  try {
    const newData = [
      {
        userId: userId,
        orderNumber: orderNumber,
        orderItems: orderItems,
        amount: amount,
        date: date,
      },
    ];

    const result = await Purchase.insertMany(newData);

    if (result.writeErrors && result.writeErrors.length > 0) {
      console.error("Failed to add data:", result.writeErrors);
    } else {
      console.log("Data added to the purchases collection");
    }

    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
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
      res.status(200);
    } catch (error) {
      res.status(401);
    }
  } else {
    res.status(401);
  }
});

app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});
