import express from "express";
import { Server } from "socket.io";
import { createServer } from "http";
import dotenv from "dotenv";
import { generateRandomNumber } from "./lib/utils.js";
dotenv.config();
const port = process.env.SERVER_PORT;

let gameObj = {
  current: "pX",
  room: null,
  pX: null,
  pO: null,
  pX_name: null,
  pO_name: null,
  match_duration: null,
  board: {
    1: null,
    2: null,
    3: null,
    4: null,
    5: null,
    6: null,
    7: null,
    8: null,
    9: null,
  },
  moves: [],
  pX_timer: {
    min: 5,
    sec: 1,
  },
  pO_timer: {
    min: 5,
    sec: 1,
  },
};

let activeGames = {};

const app = express();
const server = createServer(app);

let count = 0;

const io = new Server(server, {
  cors: {
    origin: "*", //All origin
  },
});

//Socket.io Code
io.on("connection", (socket) => {
  console.log(`User Connected. Id: ${socket.id}`);

  socket.emit("board-init", gameObj.board);

  socket.on("create-room", (name, duration) => {
    let roomId = generateRandomNumber();

    while (activeGames[roomId]) {
      roomId = generateRandomNumber();
    }

    activeGames[roomId] = {
      ...gameObj,
      room: roomId,
      pX: socket.id,
      pX_name: name,
      duration: duration,
      pX_timer: {
        min: duration,
        sec: 1,
      },
      pO_timer: {
        min: duration,
        sec: 1,
      },
    };

    socket.join(roomId);
    console.log(`${name}: ${socket.id} created room ${roomId}`);
    io.to(roomId).emit("room-created", roomId, activeGames[roomId].duration);
  });

  socket.on("join-room", (roomId, name) => {
    if (!activeGames[roomId]) {
      socket.emit("toast", true, "Room Not Found", "Wrong Room Code!");
      return;
    }

    activeGames[roomId].pO = socket.id;
    activeGames[roomId].pO_name = name;
    socket.join(roomId);
    console.log(`${name}: ${socket.id} joined room ${roomId}`);

    io.to(roomId).emit(
      "start-match",
      activeGames[roomId].pX_name,
      activeGames[roomId].pO_name,
      activeGames[roomId].current,
      activeGames[roomId].duration,
    );

  });

  socket.on("move", (index, roomId,timer1,timer2) => {
    let game = activeGames[roomId];

    if (socket.id == game[game.current]) {
      game.board[index] = game.current.charAt(1);
      game.current = game.current == "pO" ? "pX" : "pO";
      activeGames[roomId] = game;
      activeGames[roomId].pX_timer = timer1;
      activeGames[roomId].pO_timer = timer2;
      io.to(roomId).emit("board-update", activeGames[roomId].board);
      io.to(roomId).emit("turn-update", activeGames[roomId].current);

      console.log(activeGames[roomId])
    }

  });

  socket.on('time-out',(roomId,clientPlayer)=>{
    console.log(`${socket.id} time-out`)
    let winnerId;
    if(clientPlayer.tag='pX'){
      winnerId = activeGames[roomId].pO;
    }
    else{
      winnerId = activeGames[roomId].pX;
    }

    io.to(roomId).emit("game-over",winnerId)
  })

  socket.on("clearBoard", (roomId) => {
    gameObj = {
      ...activeGames[roomId],
      board: {
        1: null,
        2: null,
        3: null,
        4: null,
        5: null,
        6: null,
        7: null,
        8: null,
        9: null,
      },
    };
    activeGames[roomId] = gameObj;
    io.to(roomId).emit("board-update", activeGames[roomId].board);
  });


});

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
