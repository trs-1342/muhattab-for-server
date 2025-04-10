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
const PORT = 3000;

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
  if (!req.session.user) return res.redirect("/auth");
  res.render("index", { user: req.session.user });
});

app.get("/auth", (req, res) => {
  res.render("auth");
});

app.post("/auth", (req, res) => {
  const users = loadFromFile(USERS_PATH);
  const { username, password, action } = req.body;

  if (action === "login") {
    const user = users.find(
      (u) => u.username === username && u.password === password
    );
    if (user) {
      req.session.user = user;
      return res.redirect("/");
    }
  } else if (action === "register") {
    const userExists = users.find((u) => u.username === username);
    if (!userExists) {
      const user = { username, password };
      users.push(user);
      saveToFile(USERS_PATH, users);
      req.session.user = user;
      return res.redirect("/");
    }
  }
  res.redirect("/auth");
});

io.on("connection", (socket) => {
  const messages = loadFromFile(DATA_PATH);
  socket.emit("load messages", messages);

  socket.on("new message", (data) => {
    const newMsg = {
      text: data.text,
      sender: data.sender,
      time: new Date().toLocaleString(),
    };
    messages.push(newMsg);
    saveToFile(DATA_PATH, messages);
    io.emit("new message", newMsg);
  });
});

server.listen(PORT, () =>
  console.log(`server is running :)`)
);
