const http = require("http");
const { URL } = require("url");

const HOST = "0.0.0.0";
const PORT = 8000;
const TICK_RATE = 30;
const FRAME_TIME_MS = 1000 / TICK_RATE;
const WORLD_WIDTH = 420;
const VIEW_HEIGHT = 720;
const TARGET_HEIGHT = 5500;
const ROOM_TIMEOUT_MS = 60 * 30 * 1000;
const COLORS = ["#ffcf56", "#72f1b8"];

const HTML_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sky Sprint</title>
  <style>
    :root {
      --bg-top: #f9f3c3;
      --bg-mid: #f4a261;
      --bg-bottom: #e76f51;
      --ink: #132a13;
      --panel: rgba(255, 250, 240, 0.88);
      --line: rgba(19, 42, 19, 0.12);
      --accent: #264653;
      --accent-soft: #2a9d8f;
      --danger: #c1121f;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      min-height: 100vh;
      font-family: "Trebuchet MS", "Segoe UI", sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at top left, rgba(255,255,255,0.55), transparent 25%),
        radial-gradient(circle at 80% 20%, rgba(255,255,255,0.2), transparent 18%),
        linear-gradient(180deg, var(--bg-top), var(--bg-mid) 52%, var(--bg-bottom));
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }

    .shell {
      width: min(1120px, 100%);
      display: grid;
      grid-template-columns: 320px 1fr;
      gap: 24px;
      align-items: start;
    }

    .panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 24px;
      box-shadow: 0 18px 40px rgba(19, 42, 19, 0.18);
      backdrop-filter: blur(12px);
    }

    .sidebar {
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    h1 {
      margin: 0;
      font-size: clamp(2rem, 4vw, 3rem);
      line-height: 0.95;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .subtitle {
      margin: 0;
      color: rgba(19, 42, 19, 0.75);
      line-height: 1.5;
    }

    .controls {
      display: grid;
      gap: 12px;
    }

    button, input {
      width: 100%;
      border-radius: 999px;
      border: 1px solid rgba(19, 42, 19, 0.16);
      padding: 14px 16px;
      font: inherit;
    }

    button {
      cursor: pointer;
      color: white;
      background: linear-gradient(135deg, var(--accent), var(--accent-soft));
      transition: transform 0.18s ease, box-shadow 0.18s ease;
      box-shadow: 0 10px 24px rgba(38, 70, 83, 0.24);
    }

    button:hover {
      transform: translateY(-1px);
    }

    button.secondary {
      background: white;
      color: var(--ink);
      box-shadow: none;
    }

    .status {
      padding: 14px 16px;
      border-radius: 18px;
      background: rgba(255,255,255,0.65);
      border: 1px solid var(--line);
      min-height: 64px;
      line-height: 1.45;
    }

    .room-line {
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--accent);
    }

    .help {
      font-size: 0.94rem;
      color: rgba(19, 42, 19, 0.8);
      line-height: 1.45;
    }

    .game-panel {
      padding: 18px;
    }

    .hud {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 12px;
      flex-wrap: wrap;
    }

    .chip {
      background: rgba(255,255,255,0.76);
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 10px 14px;
      font-size: 0.95rem;
    }

    canvas {
      width: 100%;
      aspect-ratio: 7 / 11;
      border-radius: 26px;
      display: block;
      background:
        linear-gradient(180deg, #fff7cc 0%, #ffe4a3 22%, #f7b267 70%, #f4845f 100%);
      box-shadow: inset 0 0 0 1px rgba(19, 42, 19, 0.12);
    }

    .mobile-pad {
      display: none;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-top: 12px;
    }

    .mobile-pad button {
      padding: 16px;
      font-size: 1rem;
    }

    .danger {
      color: var(--danger);
      font-weight: 700;
    }

    @media (max-width: 900px) {
      .shell {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 720px) {
      body { padding: 14px; }
      .sidebar, .game-panel { padding: 16px; }
      .mobile-pad { display: grid; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <aside class="panel sidebar">
      <div>
        <h1>Sky Sprint</h1>
        <p class="subtitle">Play solo for a personal climb or create a room and race a friend to the summit.</p>
      </div>

      <div class="controls">
        <button id="soloPlay">Solo Run</button>
        <button id="createRoom">Create Room</button>
        <input id="roomInput" maxlength="4" placeholder="Enter room code">
        <button class="secondary" id="joinRoom">Join Room</button>
      </div>

      <div class="status" id="statusBox">
        Start a solo run or create a room and send the code to your friend.
      </div>

      <div class="help">
        Move with <strong>A / D</strong> or <strong>Left / Right</strong>.<br>
        On mobile, use the on-screen buttons.<br>
        Solo mode uses the same course too, so you can practice before racing.
      </div>
    </aside>

    <main class="panel game-panel">
      <div class="hud">
        <div class="chip" id="roomLabel">Room: Not connected</div>
        <div class="chip" id="playerLabel">You: Waiting</div>
        <div class="chip" id="goalLabel">Finish line: 5,500m</div>
      </div>
      <canvas id="game" width="420" height="720"></canvas>
      <div class="mobile-pad">
        <button id="leftBtn" class="secondary">Move Left</button>
        <button id="rightBtn" class="secondary">Move Right</button>
      </div>
    </main>
  </div>

  <script>
    const canvas = document.getElementById("game");
    const ctx = canvas.getContext("2d");
    const statusBox = document.getElementById("statusBox");
    const roomLabel = document.getElementById("roomLabel");
    const playerLabel = document.getElementById("playerLabel");

    const state = {
      roomCode: null,
      playerId: null,
      snapshot: null,
      connected: false,
      keys: { left: false, right: false },
      pollHandle: null,
      inputHandle: null,
    };

    function setStatus(message, isDanger = false) {
      statusBox.innerHTML = isDanger ? \`<span class="danger">\${message}</span>\` : message;
    }

    async function api(path, payload = null, method = "GET") {
      const options = { method, headers: {} };
      if (payload) {
        options.headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(payload);
      }
      const response = await fetch(path, options);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Request failed");
      }
      return data;
    }

    async function createRoom() {
      const data = await api("/api/create_room", {}, "POST");
      attachPlayer(data, true);
    }

    async function startSolo() {
      const data = await api("/api/create_room", { mode: "singleplayer" }, "POST");
      attachPlayer(data, true);
    }

    async function joinRoom() {
      const roomCode = document.getElementById("roomInput").value.trim().toUpperCase();
      if (!roomCode) {
        setStatus("Enter a room code first.", true);
        return;
      }
      const data = await api("/api/join_room", { room_code: roomCode }, "POST");
      attachPlayer(data, false);
    }

    function attachPlayer(data, created) {
      state.roomCode = data.room_code;
      state.playerId = data.player_id;
      state.connected = true;
      roomLabel.textContent = \`Room: \${data.room_code}\`;
      playerLabel.textContent = \`You: \${data.player_name}\`;
      if (data.mode === "singleplayer") {
        setStatus(\`Solo run <span class="room-line">\${data.room_code}</span> is live. Reach the summit on your own pace.\`);
      } else {
        setStatus(
          created
            ? \`Room <span class="room-line">\${data.room_code}</span> is live. Share it with your friend.\`
            : \`Joined room <span class="room-line">\${data.room_code}</span>. Race starts as soon as both players are in.\`
        );
      }
      startLoops();
    }

    function startLoops() {
      stopLoops();
      pollState();
      state.pollHandle = setInterval(pollState, 120);
      state.inputHandle = setInterval(sendInput, 70);
    }

    function stopLoops() {
      if (state.pollHandle) clearInterval(state.pollHandle);
      if (state.inputHandle) clearInterval(state.inputHandle);
    }

    async function pollState() {
      if (!state.connected) return;
      try {
        const data = await api(\`/api/state?room_code=\${state.roomCode}&player_id=\${state.playerId}\`);
        state.snapshot = data;
        render();
      } catch (error) {
        setStatus(error.message, true);
      }
    }

    async function sendInput() {
      if (!state.connected) return;
      try {
        await api("/api/input", {
          room_code: state.roomCode,
          player_id: state.playerId,
          left: state.keys.left,
          right: state.keys.right
        }, "POST");
      } catch (error) {
        setStatus(error.message, true);
      }
    }

    function worldToScreen(x, y, cameraY) {
      return {
        x,
        y: canvas.height - (y - cameraY)
      };
    }

    function drawRoundedRect(x, y, w, h, r, fill) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
    }

    function render() {
      const snapshot = state.snapshot;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!snapshot) {
        ctx.fillStyle = "rgba(19, 42, 19, 0.75)";
        ctx.font = "bold 28px Trebuchet MS";
        ctx.fillText("Create or join a room", 80, 340);
        return;
      }

      const you = snapshot.players.find((player) => player.id === state.playerId) || snapshot.players[0];
      const cameraY = Math.max(0, you.y - 220);

      ctx.fillStyle = "rgba(255,255,255,0.25)";
      for (let i = 0; i < 12; i++) {
        ctx.fillRect(0, (i * 80 + (cameraY * 0.15)) % canvas.height, canvas.width, 2);
      }

      ctx.strokeStyle = "rgba(19, 42, 19, 0.24)";
      ctx.setLineDash([8, 10]);
      const finishY = canvas.height - (snapshot.target_height - cameraY);
      ctx.beginPath();
      ctx.moveTo(0, finishY);
      ctx.lineTo(canvas.width, finishY);
      ctx.stroke();
      ctx.setLineDash([]);

      snapshot.platforms.forEach((platform) => {
        if (platform.y < cameraY - 40 || platform.y > cameraY + canvas.height + 40) return;
        const pos = worldToScreen(platform.x, platform.y, cameraY);
        drawRoundedRect(pos.x, pos.y - 10, platform.width, 10, 8, "#2a9d8f");
      });

      snapshot.players.forEach((player) => {
        if (!player.active) return;
        const pos = worldToScreen(player.x, player.y, cameraY);
        drawRoundedRect(pos.x, pos.y - player.height, player.width, player.height, 12, player.color);
        ctx.fillStyle = "#132a13";
        ctx.font = "bold 14px Trebuchet MS";
        ctx.fillText(player.name, pos.x - 4, pos.y - player.height - 10);
      });

      ctx.fillStyle = "#132a13";
      ctx.font = "bold 18px Trebuchet MS";
      ctx.fillText(\`You: \${Math.floor(you.progress)}m\`, 16, 32);
      const opponent = snapshot.players.find((player) => player.id !== state.playerId && player.active);
      ctx.fillText(
        opponent ? \`\${opponent.name}: \${Math.floor(opponent.progress)}m\` : "Waiting for friend...",
        16,
        58
      );

      if (!snapshot.started && snapshot.mode === "multiplayer") {
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        drawRoundedRect(52, 280, 316, 112, 24, "rgba(255,255,255,0.78)");
        ctx.fillStyle = "#132a13";
        ctx.font = "bold 28px Trebuchet MS";
        ctx.fillText("Waiting for players", 92, 326);
        ctx.font = "18px Trebuchet MS";
        ctx.fillText("Invite your friend with the room code.", 86, 360);
      } else if (snapshot.winner_name) {
        drawRoundedRect(72, 260, 276, 132, 24, "rgba(255,255,255,0.82)");
        ctx.fillStyle = "#132a13";
        ctx.font = "bold 26px Trebuchet MS";
        ctx.fillText(\`\${snapshot.winner_name} wins!\`, 114, 314);
        ctx.font = "18px Trebuchet MS";
        ctx.fillText("Refresh to race again.", 135, 350);
      }
    }

    function setKey(key, pressed) {
      if (key === "ArrowLeft" || key === "a" || key === "A") state.keys.left = pressed;
      if (key === "ArrowRight" || key === "d" || key === "D") state.keys.right = pressed;
    }

    window.addEventListener("keydown", (event) => setKey(event.key, true));
    window.addEventListener("keyup", (event) => setKey(event.key, false));

    function bindHoldButton(id, key) {
      const element = document.getElementById(id);
      const on = () => { state.keys[key] = true; };
      const off = () => { state.keys[key] = false; };
      ["pointerdown", "touchstart"].forEach((name) => element.addEventListener(name, on));
      ["pointerup", "pointerleave", "touchend", "touchcancel"].forEach((name) => element.addEventListener(name, off));
    }

    bindHoldButton("leftBtn", "left");
    bindHoldButton("rightBtn", "right");

    document.getElementById("createRoom").addEventListener("click", async () => {
      try {
        await createRoom();
      } catch (error) {
        setStatus(error.message, true);
      }
    });

    document.getElementById("soloPlay").addEventListener("click", async () => {
      try {
        await startSolo();
      } catch (error) {
        setStatus(error.message, true);
      }
    });

    document.getElementById("joinRoom").addEventListener("click", async () => {
      try {
        await joinRoom();
      } catch (error) {
        setStatus(error.message, true);
      }
    });

    render();
  </script>
</body>
</html>
`;

function generateCode(length = 4) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let index = 0; index < length; index += 1) {
    result += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return result;
}

function createPlayer({ id, name, x, color }) {
  return {
    id,
    name,
    x,
    start_x: x,
    y: 120,
    vx: 0,
    vy: 0,
    width: 34,
    height: 34,
    left: false,
    right: false,
    progress: 0,
    active: true,
    color,
  };
}

class Room {
  constructor(code, seed, mode = "multiplayer") {
    this.code = code;
    this.seed = seed;
    this.mode = mode;
    this.players = new Map();
    this.platforms = [];
    this.started = mode === "singleplayer";
    this.winnerId = null;
    this.lastActive = Date.now();
  }

  toJSON() {
    const winner = this.winnerId ? this.players.get(this.winnerId) : null;
    return {
      room_code: this.code,
      mode: this.mode,
      started: this.started,
      winner_name: winner ? winner.name : null,
      target_height: TARGET_HEIGHT,
      players: Array.from(this.players.values(), (player) => ({
        id: player.id,
        name: player.name,
        x: Number(player.x.toFixed(2)),
        y: Number(player.y.toFixed(2)),
        width: player.width,
        height: player.height,
        progress: Number(player.progress.toFixed(1)),
        active: player.active,
        color: player.color,
      })),
      platforms: this.platforms,
    };
  }
}

class Random {
  constructor(seed) {
    this.seed = seed >>> 0;
  }

  next() {
    this.seed = (1664525 * this.seed + 1013904223) >>> 0;
    return this.seed / 0x100000000;
  }

  randint(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}

class GameState {
  constructor() {
    this.rooms = new Map();
  }

  createRoom(mode = "multiplayer") {
    let code = generateCode();
    while (this.rooms.has(code)) {
      code = generateCode();
    }

    const room = new Room(code, Math.floor(Math.random() * 1_000_001), mode);
    room.platforms = this.generatePlatforms(room.seed);

    const playerId = generateCode(8);
    room.players.set(
      playerId,
      createPlayer({
        id: playerId,
        name: mode === "multiplayer" ? "Player 1" : "Solo",
        x: 110,
        color: COLORS[0],
      })
    );

    this.rooms.set(code, room);
    return { roomCode: code, playerId };
  }

  joinRoom(code) {
    const room = this.requireRoom(code);
    if (room.mode !== "multiplayer") {
      throw new Error("That room is not accepting multiplayer joins.");
    }
    if (room.players.size >= 2) {
      throw new Error("That room is full.");
    }

    const playerId = generateCode(8);
    room.players.set(
      playerId,
      createPlayer({
        id: playerId,
        name: "Player 2",
        x: 260,
        color: COLORS[1],
      })
    );
    room.started = true;
    room.lastActive = Date.now();
    return { roomCode: code, playerId };
  }

  updateInput(code, playerId, left, right) {
    const room = this.requireRoom(code);
    const player = this.requirePlayer(room, playerId);
    player.left = left;
    player.right = right;
    room.lastActive = Date.now();
  }

  getState(code, playerId) {
    const room = this.requireRoom(code);
    this.requirePlayer(room, playerId);
    room.lastActive = Date.now();
    return room.toJSON();
  }

  tick() {
    const now = Date.now();
    for (const [code, room] of this.rooms.entries()) {
      if (now - room.lastActive > ROOM_TIMEOUT_MS) {
        this.rooms.delete(code);
        continue;
      }
      if (room.started && !room.winnerId) {
        this.updateRoom(room);
      }
    }
  }

  updateRoom(room) {
    for (const player of room.players.values()) {
      let accel = 0;
      if (player.left) accel -= 1;
      if (player.right) accel += 1;

      player.vx += accel * 0.9;
      player.vx *= 0.86;
      player.vx = Math.max(-7, Math.min(7, player.vx));
      player.vy -= 0.48;

      player.x = (player.x + player.vx + WORLD_WIDTH) % WORLD_WIDTH;
      const previousY = player.y;
      player.y += player.vy;

      if (player.vy <= 0) {
        for (const platform of room.platforms) {
          const withinX =
            player.x + player.width > platform.x &&
            player.x < platform.x + platform.width;
          const crossingY = previousY >= platform.y && platform.y >= player.y - 6;
          if (withinX && crossingY) {
            player.y = platform.y + 2;
            player.vy = 12.4;
            break;
          }
        }
      }

      if (player.y < -140) {
        player.y = 120;
        player.x = player.start_x;
        player.vx = 0;
        player.vy = 0;
      }

      player.progress = Math.max(player.progress, player.y);
      if (player.progress >= TARGET_HEIGHT) {
        room.winnerId = player.id;
      }
    }
  }

  generatePlatforms(seed) {
    const rng = new Random(seed);
    const platforms = [{ x: 20, y: 90, width: 380 }];
    let y = 180;

    while (y <= TARGET_HEIGHT + VIEW_HEIGHT) {
      const width = rng.randint(72, 108);
      const x = rng.randint(16, WORLD_WIDTH - width - 16);
      platforms.push({ x, y, width });
      y += rng.randint(72, 108);
    }

    return platforms;
  }

  requireRoom(code) {
    const room = this.rooms.get(code);
    if (!room) {
      throw new Error("Room not found.");
    }
    return room;
  }

  requirePlayer(room, playerId) {
    const player = room.players.get(playerId);
    if (!player) {
      throw new Error("Player not found in that room.");
    }
    return player;
  }
}

const state = new GameState();

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";

    req.on("data", (chunk) => {
      raw += chunk;
    });

    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });

    req.on("error", reject);
  });
}

function sendHtml(res, html) {
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": Buffer.byteLength(html),
  });
  res.end(html);
}

function sendJson(res, payload, status = 200) {
  const encoded = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(encoded),
  });
  res.end(encoded);
}

function sendErrorJson(res, message, status) {
  sendJson(res, { error: message }, status);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || `127.0.0.1:${PORT}`}`);

  try {
    if (req.method === "GET" && url.pathname === "/") {
      sendHtml(res, HTML_PAGE);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/state") {
      const roomCode = (url.searchParams.get("room_code") || "").toUpperCase();
      const playerId = url.searchParams.get("player_id") || "";
      try {
        sendJson(res, state.getState(roomCode, playerId));
      } catch (error) {
        sendErrorJson(res, error.message, 404);
      }
      return;
    }

    if (req.method === "POST") {
      let data;
      try {
        data = await readJsonBody(req);
      } catch (error) {
        sendErrorJson(res, error.message, 400);
        return;
      }

      try {
        if (url.pathname === "/api/create_room") {
          const mode = data.mode || "multiplayer";
          const { roomCode, playerId } = state.createRoom(mode);
          sendJson(
            res,
            {
              room_code: roomCode,
              player_id: playerId,
              player_name: mode === "multiplayer" ? "Player 1" : "Solo",
              mode,
            },
            201
          );
          return;
        }

        if (url.pathname === "/api/join_room") {
          const roomCode = (data.room_code || "").toUpperCase();
          const { roomCode: joinedRoomCode, playerId } = state.joinRoom(roomCode);
          sendJson(
            res,
            {
              room_code: joinedRoomCode,
              player_id: playerId,
              player_name: "Player 2",
              mode: "multiplayer",
            },
            201
          );
          return;
        }

        if (url.pathname === "/api/input") {
          state.updateInput(
            (data.room_code || "").toUpperCase(),
            data.player_id || "",
            Boolean(data.left),
            Boolean(data.right)
          );
          sendJson(res, { ok: true });
          return;
        }

        sendErrorJson(res, "Not found.", 404);
      } catch (error) {
        sendErrorJson(res, error.message, 400);
      }
      return;
    }

    sendErrorJson(res, "Not found.", 404);
  } catch (error) {
    sendErrorJson(res, "Internal server error.", 500);
  }
});

setInterval(() => state.tick(), FRAME_TIME_MS);

server.listen(PORT, HOST, () => {
  console.log(`Sky Sprint running on http://127.0.0.1:${PORT}`);
});
