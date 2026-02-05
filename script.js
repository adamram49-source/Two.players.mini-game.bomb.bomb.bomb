import { ref, set, get, onValue, update }
from "https://www.gstatic.com/firebasejs/12.8.0/firebase-database.js";

const db = window.firebaseDB;

let gameCode = "";
let playerId = "";
let gameRef = null;

document.getElementById("createBtn").onclick = createGame;
document.getElementById("joinBtn").onclick = joinGame;
document.getElementById("saveNameBtn").onclick = saveName;

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

/* יצירת משחק */
async function createGame() {
  gameCode = generateCode();
  playerId = "p1";
  gameRef = ref(db, "games/" + gameCode);

  await set(gameRef, {
    players: { p1: true },
    phase: "waiting"
  });

  document.getElementById("status").innerText =
    `קוד המשחק: ${gameCode}\nממתין לשחקן נוסף...`;

  listen();
}

/* הצטרפות */
async function joinGame() {
  const code = document.getElementById("codeInput").value.trim().toUpperCase();
  if (!code) return;

  gameCode = code;
  playerId = "p2";
  gameRef = ref(db, "games/" + gameCode);

  const snap = await get(gameRef);
  if (!snap.exists()) {
    alert("קוד לא קיים");
    return;
  }

  await update(gameRef, {
    "players/p2": true,
    phase: "names"
  });

  listen();
}

/* האזנה */
function listen() {
  onValue(gameRef, snap => {
    const data = snap.val();
    if (!data) return;

    if (data.phase === "waiting") {
      document.getElementById("status").innerText =
        `קוד המשחק: ${gameCode}\nממתין לשחקן נוסף...`;
    }

    if (data.phase === "names") showNameScreen(data);
    if (data.phase === "bombs") startBombPhase(data);
    if (data.phase === "play") startPlayPhase(data);
  });
}

/* שמות */
function showNameScreen(data) {
  document.getElementById("home").classList.add("hidden");
  document.getElementById("status").classList.add("hidden");
  document.getElementById("nameScreen").classList.remove("hidden");

  const names = data.names || {};
  if (names[playerId]) {
    document.getElementById("waitText").innerText =
      "ממתין לשחקן השני...";
  }
}

async function saveName() {
  const name = document.getElementById("nameInput").value.trim();
  if (!name) return;

  await update(gameRef, { [`names/${playerId}`]: name });

  const snap = await get(gameRef);
  const data = snap.val();

  if (data.names?.p1 && data.names?.p2) {
    await update(gameRef, {
      phase: "bombs",
      turn: "p1",
      hearts: { p1: 3, p2: 3 }
    });
  }
}

/* יצירת לוח */
function drawBoard(clickHandler) {
  const board = document.getElementById("board");
  board.innerHTML = "";

  for (let i = 0; i < 18; i++) {
    const div = document.createElement("div");
    div.className = "circle";
    div.onclick = () => clickHandler(i, div);
    board.appendChild(div);
  }
}

/* שלב הפצצות */
function startBombPhase(data) {
  document.getElementById("nameScreen").classList.add("hidden");
  document.getElementById("board").classList.remove("hidden");

  const myTurn = data.turn === playerId;
  document.getElementById("turnText").innerText =
    myTurn ? "בחר 3 פצצות" : "תור היריב לבחור פצצות";

  if (!myTurn) return;

  let chosen = [];

  drawBoard(async (i, div) => {
    if (chosen.includes(i) || chosen.length >= 3) return;

    chosen.push(i);
    div.style.background = "red";

    if (chosen.length === 3) {
      await update(gameRef, {
        [`bombs/${playerId}`]: chosen,
        turn: playerId === "p1" ? "p2" : "p1",
        phase: playerId === "p2" ? "play" : "bombs"
      });
    }
  });
}

/* שלב המשחק */
function startPlayPhase(data) {
  document.getElementById("hearts").classList.remove("hidden");

  const myTurn = data.turn === playerId;
  const enemy = playerId === "p1" ? "p2" : "p1";

  document.getElementById("turnText").innerText =
    myTurn ? "בחר עיגול של האויב" : "תור היריב";

  document.getElementById("hearts").innerText =
    "❤️".repeat(data.hearts[playerId]);

  if (!myTurn) return;

  drawBoard(async (i, div) => {
    const bombs = data.bombs?.[enemy] || [];

    let newHearts = data.hearts[playerId];

    if (bombs.includes(i)) {
      div.style.background = "black";
      alert("BOOM!!!");
      newHearts--;
    } else {
      div.style.background = "green";
      alert("SAVE!!!");
    }

    await update(gameRef, {
      [`hearts/${playerId}`]: newHearts,
      turn: enemy
    });
  });
}
