const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const router = express.Router();

function compareAsync(param1, param2) {
  return new Promise(function (resolve, reject) {
    bcrypt.compare(param1, param2, function (err, res) {
      if (err) {
        reject(err);
      } else {
        resolve(res);
      }
    });
  });
}

// Registration route
router.post("/register", async (req, res) => {
  try {
    const { name, username, password } = req.body;

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: "Username already taken" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      username,
      password: hashedPassword,
    });
    await user.save();

    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    res.status(500).json({ message: "An error occurred" });
  }
});

// Login route
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    // Find the user by username
    const user = await User.findOne({ username });
    if (!user) {
      return res.json({ message: "Username does not exists" });
    }
    // Compare passwords
    const isPasswordValid = await compareAsync(password, user.password);
    if (!isPasswordValid) {
      return res.json({ message: "Invalid Password" });
    }

    // Generate a JWT token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET_KEY, {
      expiresIn: "24h",
    });

    res.json({ token: token, message: "Logged in Successfully" });
  } catch (error) {
    res.status(500).json({ message: "An error occurred" });
  }
});

module.exports = router;
