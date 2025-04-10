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
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const DELETE_PASSWORD = process.env.DELETE_PASSWORD;

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
    if (userExists || username == ADMIN_USERNAME) {
      return res.send(
        '<h3 style="color:red;text-align:center">Bu kullanıcı adı kullanılamaz veya zaten var.</h3><a href="/auth">Geri Dön</a>'
      );
    }
    const user = { username, password };
    users.push(user);
    saveToFile(USERS_PATH, users);
    req.session.user = user;
    return res.redirect("/");
  }
  res.redirect("/auth");
});

io.on("connection", (socket) => {
  const messages = loadFromFile(DATA_PATH);
  socket.emit("load messages", messages);

  socket.on("new message", (data) => {
    const { text, sender } = data;

    // if (sender !== !ADMIN_USERNAME) {
    //   socket.emit("new message", {
    //     text: "Bu kullanıcı mesaj gönderemez.",
    //     sender: "Sistem",
    //     time: new Date().toLocaleString(),
    //   });
    //   return;
    // }

    if (text.startsWith("/delete")) {
      const parts = text.split(" ");
      const inputPassword = parts[1] || "";
      if (inputPassword === DELETE_PASSWORD) {
        saveToFile(DATA_PATH, []);
        io.emit("load messages", []);
      } else {
        socket.emit("new message", {
          text: "Yanlış şifre. Mesajlar silinmedi.",
          sender: "Sistem",
          time: new Date().toLocaleString(),
        });
      }
      return;
    }

    const newMsg = { text, sender, time: new Date().toLocaleString() };
    messages.push(newMsg);
    saveToFile(DATA_PATH, messages);
    io.emit("new message", newMsg);
  });
});

server.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
