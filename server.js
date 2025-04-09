require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const session = require("express-session");
const http = require("http");
const { Server } = require("socket.io");
const app = express();
const server = http.createServer(app);
const io = new Server(server);

const DATA_PATH = process.env.DATA_PATH || "./data/messages.json";
const USERS_PATH = process.env.USERS_PATH || "./data/users.json";

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));
app.use(
  session({ secret: "supersecret", resave: false, saveUninitialized: true })
);

function saveToFile(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function loadFromFile(file) {
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file));
}

app.get("/", (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  res.render("index", { user: req.session.user });
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/login", (req, res) => {
  const users = loadFromFile(USERS_PATH);
  const user = users.find(
    (u) => u.username === req.body.username && u.password === req.body.password
  );
  if (user) {
    req.session.user = user;
    res.redirect("/");
  } else {
    res.redirect("/login");
  }
});

app.get("/register", (req, res) => {
  res.render("register");
});

app.post("/register", (req, res) => {
  const users = loadFromFile(USERS_PATH);
  const user = { username: req.body.username, password: req.body.password };
  users.push(user);
  saveToFile(USERS_PATH, users);
  res.redirect("/login");
});

io.on("connection", (socket) => {
  const messages = loadFromFile(DATA_PATH);
  socket.emit("load messages", messages);

  socket.on("new message", (msg) => {
    const newMsg = { text: msg, time: new Date().toLocaleString() };
    messages.push(newMsg);
    saveToFile(DATA_PATH, messages);
    io.emit("new message", newMsg);
  });
});

server.listen(3000, () =>
  console.log("Server running on http://localhost:3000")
);
