import express from "express";
import { Server } from "socket.io";
import { createServer } from "http";
import dotenv from "dotenv";
import cors from "cors";
import {
  calculateWinner,
  drawCheck,
  generateRandomNumber,
  getGamebySocketId,
} from "./lib/utils.js";
dotenv.config();
const port = process.env.SERVER_PORT;

const gameObj = {
  current: "pX",
  room: null,
  pX: null,
  pO: null,
  pX_name: null,
  pO_name: null,
  duration: null,
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

//Games Lobby
let activeGames = {};

const app = express();
const server = createServer(app);

app.use(cors());

const io = new Server(server, {
  cors: {
    origin: "*",
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
      current: "pX",
      room: roomId,
      pX: socket.id,
      pX_name: name,
      duration: duration,
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
        min: duration,
        sec: 0,
      },
      pO_timer: {
        min: duration,
        sec: 0,
      },
    };

    socket.join(roomId);
    console.log(`${name}: ${socket.id} created room ${roomId}`);
    io.to(roomId).emit("room-created", roomId, activeGames[roomId].duration);
    console.log("----------Created------------");
    console.log(activeGames);
  });

  socket.on("join-room", (roomId, name) => {
    if (!activeGames[roomId]) {
      socket.emit("toast", false, "Room Not Found", "Wrong Room Code!");
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
      activeGames[roomId].duration
    );

    console.log("----------Joined------------");
    console.log(activeGames);
  });

  socket.on("move", (index, roomId, timer1, timer2) => {
    if (!activeGames[roomId]) {
      socket.emit("toast", false, "Invalid Room", "Server Error");
      return;
    }

    let game = activeGames[roomId];

    if (socket.id == game[game.current]) {
      game.board[index] = game.current.charAt(1);
      game.current = game.current == "pO" ? "pX" : "pO";

      //Updating Move Queue
      let message = null;
      if (activeGames[roomId].moves.length == 7) {
        const disappearSquare = game.moves.shift();
        game.board[disappearSquare] = null;
        message = `Sqaure ${disappearSquare} - Disappeared.`;
      }
      //Pushing New Move
      game.moves.push(index);

      //Applying Changes
      activeGames[roomId] = game;
      activeGames[roomId].pX_timer = timer1;
      activeGames[roomId].pO_timer = timer2;

      const { winner, line } = calculateWinner(activeGames[roomId].board);

      if (winner) {
        let winnerName = null;
        if (winner == "X") {
          winnerName = activeGames[roomId].pX_name;
        } else {
          winnerName = activeGames[roomId].pO_name;
        }
        io.to(roomId).emit(
          "game-over-by-move",
          socket.id,
          line,
          activeGames[roomId].board,
          winnerName
        );
        delete activeGames[roomId];

        console.log("--------Win - Deleted----------");
        console.log(activeGames);
        return;
      }

      const draw = drawCheck(activeGames[roomId].board);
      if (draw) {
        io.to(roomId).emit("game-draw", activeGames[roomId].board);

        console.log("--------Draw - Deleted----------");
        console.log(activeGames);
        return;
      }

      io.to(roomId).emit("board-update", activeGames[roomId].board, message);
      io.to(roomId).emit("turn-update", activeGames[roomId].current);
    }
  });

  socket.on("time-out", (roomId, clientPlayer) => {
    if (!activeGames[roomId]) {
      socket.emit("toast", false, "Room Not Found", "Server Error");
      return;
    }

    console.log(`${socket.id} time-out`);
    let winnerId, timeoutPlayer;
    if (clientPlayer.tag == "pX") {
      winnerId = activeGames[roomId].pO;
      timeoutPlayer = activeGames[roomId].pX_name;
    } else {
      winnerId = activeGames[roomId].pX;
      timeoutPlayer = activeGames[roomId].pO_name;
    }

    io.to(roomId).emit("game-over-by-timeout", winnerId, timeoutPlayer);
    delete activeGames[roomId];

    console.log("----------Deleted------------");
    console.log(activeGames);
  });

  socket.on("disconnect", () => {
    console.log(`${socket.id} disconnected.`);
    const game = getGamebySocketId(activeGames, socket.id);

    if (!game) {
      console.log("No Game");
      return;
    }

    let winnerId, disconnectedPlayer;
    if (game.pX == socket.id) {
      winnerId = game.pO;
      disconnectedPlayer = game.pX_name;
    } else {
      winnerId = game.pX;
      disconnectedPlayer = game.pO_name;
    }

    console.log(game.room);

    io.to(game.room).emit(
      "game-over-by-disconnect",
      winnerId,
      disconnectedPlayer
    );
    delete activeGames[game.room];

    console.log("----------Deleted------------");
    console.log(activeGames);
  });
});

app.get("/", (req, res) => {
  res.status(200).json({
    active: true,
    message: "Server is Running",
  });
});

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
