const mongoose = require("mongoose");

const purchaseSchema = new mongoose.Schema({
  orderNumber: String,
  amount: Number,
  userId: String,
  orderItems: String,
  date: String,
});

module.exports = mongoose.model("Purchase", purchaseSchema);
