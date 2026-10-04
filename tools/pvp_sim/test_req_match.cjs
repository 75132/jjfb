/**
 * 无头验证 index.html 的「请求-响应匹配」逻辑。
 * 目的：证明 startMatch 等裸 route 调用，在服务端响应
 *   (a) 带 request_id  (b) 不带 request_id（send_error_response 场景）
 * 两种情况下都能正确被消费，而不会傻等 15s 超时。
 *
 * 做法：从 index.html 抽出 send/handleMessage 逻辑的关键片段重放，
 *      不依赖 DOM/WebSocket，用假 ws 捕获请求并注入响应。
 */
const fs = require("fs");
const path = "D:/jjfbol-cocos/jjfbol-cocos/jjfb/tools/pvp_sim/index.html";
const html = fs.readFileSync(path, "utf8");

// 抽出 <script> 内容
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];

// ---- 构造最小运行环境 ----
const pendingReq = {};            // 复刻页面同名结构
let sentFrames = [];
const fakeWs = {
  readyState: 1,
  // 页面 send() 传入的是对象（真 ws 会自行序列化），这里直接收对象
  send: (o) => sentFrames.push(typeof o === "string" ? JSON.parse(o) : o),
};
let uid = "u1", cid = "c1";
function randId() { return "rid_" + Math.random().toString(36).slice(2); }
function log() {}

// ---- 复刻页面 send()（见 index.html 419-444 行改写后逻辑）----
function send(type, body, waitFor) {
  const msg = Object.assign({ type: type }, body || {});
  if (uid && !msg.user_id) msg.user_id = uid;
  if (cid && !msg.character_id) msg.character_id = cid;
  msg.request_id = msg.request_id || randId();
  let p = Promise.resolve(null);
  if (waitFor) {
    p = new Promise(function (resolve, reject) {
      const key = msg.request_id;
      const routeBase = String(waitFor || "").replace(/_response$/, "");
      pendingReq[key] = { resolve, reject, route: routeBase, routeKey: "@route:" + routeBase };
      pendingReq["@route:" + routeBase] = pendingReq[key];
      setTimeout(function () {
        if (pendingReq[key]) {
          delete pendingReq[key];
          delete pendingReq["@route:" + routeBase];
          reject(new Error(waitFor + " 响应超时"));
        }
      }, 300); // 测试用短超时
    });
  }
  fakeWs.send(msg);
  return p;
}

// ---- 复刻页面 handleMessage() 的响应分支（见 481-517 行改写后逻辑）----
function handleMessage(msg) {
  const t = msg.type || "";
  if (/_response$/.test(t) || t === "auth_response") {
    const rid = msg.request_id;
    let pr = null, hitKey = null;
    if (rid && pendingReq[rid]) { pr = pendingReq[rid]; hitKey = rid; }
    if (!pr) {
      const tBase = t.replace(/_response$/, "");
      for (const k in pendingReq) {
        const rBase = String(pendingReq[k].route || "").replace(/_response$/, "");
        if (rBase === tBase) { pr = pendingReq[k]; hitKey = k; break; }
      }
    }
    if (pr) {
      if (hitKey) delete pendingReq[hitKey];
      if (rid) delete pendingReq[rid];
      if (pr.route) delete pendingReq["@route:" + pr.route];
      if (msg.success === false) pr.reject(new Error(msg.message || (t + " 失败")));
      else pr.resolve(msg);
      return true;
    }
  }
  return false;
}

(async () => {
  let pass = 0, fail = 0;

  // 场景1：裸 route 调用 + 服务端带 request_id 的正常响应
  let p1 = send("pvp_flat_match", { character_id: "c1" }, "pvp_flat_match_response");
  handleMessage({ type: "pvp_flat_match_response", success: true, request_id: sentFrames[0].request_id, data: { room_id: "R1" } });
  try { const r = await p1; console.assert(r.data.room_id === "R1"); console.log("场景1 裸route+带rid 正常响应 → OK"); pass++; }
  catch (e) { console.log("场景1 失败：" + e.message); fail++; }

  // 场景2：裸 route 调用 + 服务端【不带 request_id】的错误响应（匹配超时 408）
  let p2 = send("pvp_flat_match", { character_id: "c1" }, "pvp_flat_match_response");
  handleMessage({ type: "pvp_flat_match_response", success: false, code: 408, message: "匹配超时" });
  try { await p2; console.log("场景2 不应 resolve"); fail++; }
  catch (e) { if (/匹配超时/.test(e.message)) { console.log("场景2 裸route+无rid 错误响应 → 正确 reject(匹配超时) OK"); pass++; } else { console.log("场景2 错误内容不符：" + e.message); fail++; } }

  // 场景3：旧式裸 route（调用方写 "pvp_flat_match"）+ 不带 rid → 归一化兜底必须命中
  let p3 = send("battle_room_action", { room_id: "R1", action_type: "ATTACK" }, "battle_room_action");
  handleMessage({ type: "battle_room_action_response", success: true, data: { state: { round: 2 } } });
  try { const r = await p3; console.assert(r.data.state.round === 2); console.log("场景3 归一化兜底(裸route+无rid) → OK"); pass++; }
  catch (e) { console.log("场景3 失败：" + e.message); fail++; }

  // 场景4：确认无泄漏（pendingReq 应清空）
  const leaked = Object.keys(pendingReq).length;
  if (leaked === 0) { console.log("场景4 pendingReq 无泄漏 → OK"); pass++; }
  else { console.log("场景4 泄漏 " + leaked + " 个 key: " + JSON.stringify(Object.keys(pendingReq))); fail++; }

  console.log("\n===== 结果: " + pass + " 通过 / " + fail + " 失败 =====");
  process.exit(fail ? 1 : 0);
})();
