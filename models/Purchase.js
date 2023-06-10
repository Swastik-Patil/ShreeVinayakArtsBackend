const mongoose = require("mongoose");

const purchaseSchema = new mongoose.Schema({
  userId: String,
  OrderId: String,
  orderItems: String,
  amount: Number,
  receipt: String,
  mode: String,
  date: String,
});

module.exports = mongoose.model("Purchase", purchaseSchema);
