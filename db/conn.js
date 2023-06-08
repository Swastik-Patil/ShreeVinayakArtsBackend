const mongoose = require("mongoose");
const Db = process.env.MONGO_URL;

const connectToDatabase = async () => {
  try {
    await mongoose.connect(Db, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
  }
};

module.exports = connectToDatabase;
