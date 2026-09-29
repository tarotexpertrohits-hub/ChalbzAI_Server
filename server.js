const http = require("http");
const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");

const PORT = 3000;
const DAILY_LIMIT = 2000;
const MODEL = "gpt-5.6-luna";

const BASE_DIR = __dirname;
const ACCESS_FILE = path.join(BASE_DIR, "access_codes.json");
const USERS_FILE = path.join(BASE_DIR, "users.json");
const RESULTS_FILE = path.join(BASE_DIR, "trade_results.json");

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// ======================================================
// FILE HELPERS
// ======================================================

function readJson(file, fallback) {
    try {
        if (!fs.existsSync(file)) {
            fs.writeFileSync(file, JSON.stringify(fallback, null, 2));
            return fallback;
        }

        const text = fs.readFileSync(file, "utf8").trim();

        if (!text) {
            fs.writeFileSync(file, JSON.stringify(fallback, null, 2));
            return fallback;
        }

        return JSON.parse(text);
    } catch (err) {
        console.log("JSON READ ERROR:", file, err.message);
        return fallback;
    }
}

function writeJson(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function today() {
    return new Date().toISOString().slice(0, 10);
}

function send(res, status, data) {
    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
    });

    res.end(JSON.stringify(data));
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = "";

        req.on("data", chunk => {
            body += chunk;

            if (body.length > 15 * 1024 * 1024) {
                reject(new Error("REQUEST TOO LARGE"));
                req.destroy();
            }
        });

        req.on("end", () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (e) {
                reject(new Error("INVALID JSON"));
            }
        });

        req.on("error", reject);
    });
}

// ======================================================
// 20 EXACT CANDLE LOOPS
// ======================================================

const LOOPS = [
    "1. Streak Loop",
    "2. Alternating Loop",
    "3. Mirror Loop",
    "4. Split Loop",
    "5. Sandwich Loop",
    "6. Reversal Loop",
    "7. Continuation Loop",
    "8. Expansion Loop",
    "9. Contraction Loop",
    "10. Wick-Rejection Loop",
    "11. Engulfing Loop",
    "12. Inside-Candle Loop",
    "13. Breakout Loop",
    "14. Fake-Break Loop",
    "15. Liquidity-Sweep Loop",
    "16. Support-Rejection Loop",
    "17. Resistance-Rejection Loop",
    "18. Grid/Round-Number Loop",
    "19. Momentum-Shift Loop",
    "20. Exhaustion Loop"
];

// ======================================================
// 12 EXACT CORE RULES
// ======================================================

const CORE_RULES = [
    "1. Micro-Sequence Symmetry — last 5 candles; Mirror G-G-R-G-G or Split G-R-G-R-G.",
    "2. Artificial Opening Gap Skew — gap above previous close = stop-loss hunt, counter-strike priority.",
    "3. Last 3-Second Velocity Vector — violent final 3-second spike = continuation.",
    "4. Wick-to-Body Volatility Ratio — key grid rejection wick >60% total candle size = momentum rejected.",
    "5. Grid Level Magnet Theory — within 3 pips of .000/.500 = magnet/touch-before-reversal.",
    "6. Hyper-Sensitive RSI 5 Core — RSI5 >85 + top wick PUT; RSI5 <15 + bottom wick CALL; 50 break + high velocity continuation.",
    "7. Ultra-Fast MACD Cluster — MACD (3,9,3); histogram flip above zero CALL continuation; dead-cross deep overbought aggressive PUT.",
    "8. ATR5 Volatility Matrix — current candle >2x ATR5 = exhaustion climax; next candle reversal expectation.",
    "9. Volume-Size Divergence Trap — smaller body while velocity increases = reversal loop.",
    "10. Broker Slippage Buffer Check — entry timing assumes 1-second broker transmission delay.",
    "11. Structural Micro-Trend Flow — last 15 candles macro bias using HH/HL/LH/LL.",
    "12. Martingale Recovery Flow — only after actual confirmed LOSS on the same pair."
];

// ======================================================
// USER / ACCESS HELPERS
// ======================================================

function getAccessCodes() {
    return readJson(ACCESS_FILE, {
        "CHALBZAI-2026-001": {
            active: true,
            boundEmail: null,
            boundDevice: null
        }
    });
}

function getUsers() {
    return readJson(USERS_FILE, {});
}

function saveUsers(users) {
    writeJson(USERS_FILE, users);
}

function getTradeResults() {
    return readJson(RESULTS_FILE, {});
}

function saveTradeResults(results) {
    writeJson(RESULTS_FILE, results);
}

function clean(value) {
    return String(value || "").trim();
}

function getUserDailyInfo(users, email) {
    const d = today();

    if (!users[email]) {
        users[email] = {
            email,
            createdAt: new Date().toISOString(),
            dailyDate: d,
            dailyUsed: 0
        };
    }

    if (users[email].dailyDate !== d) {
        users[email].dailyDate = d;
        users[email].dailyUsed = 0;
    }

    return users[email];
}

// ======================================================
// MARTINGALE
// ======================================================

function getPreviousResult(email, pair) {
    const results = getTradeResults();

    const key = `${email.toLowerCase()}|${String(pair || "").toUpperCase()}`;

    return results[key] || null;
}

function setTradeResult(email, pair, direction, result, stake) {
    const results = getTradeResults();

    const key = `${email.toLowerCase()}|${String(pair || "").toUpperCase()}`;

    results[key] = {
        pair: String(pair || "").toUpperCase(),
        direction: String(direction || "").toUpperCase(),
        result: String(result || "").toUpperCase(),
        stake: Number(stake || 1),
        confirmedAt: new Date().toISOString()
    };

    saveTradeResults(results);
}

// ======================================================
// PRIVATE STRATEGY PROMPT
// ======================================================

const PRIVATE_STRATEGY = `
CHALBZAI PRIVATE STRATEGY ENGINE

Use ONLY the following 20 candle loops and 12 core rules.

20 LOOPS:
${LOOPS.join("\n")}

12 CORE RULES:
${CORE_RULES.join("\n")}

IMPORTANT DATA INTEGRITY:
- Never invent RSI5 numerical values.
- Never invent MACD numerical values.
- Never invent ATR5 numerical values.
- Never invent volume values.
- Never invent 3-second velocity values.
- Never invent a gap value.
- Never invent an entry price.
- Never invent a chart timestamp.
- Never claim a loop is confirmed unless visible/derivable evidence supports it.
- If a rule requires unavailable data, mark it NOT CONFIRMED.
- Do not pretend an indicator panel exists when it does not.
- RSI5, MACD(3,9,3), ATR5 and similar indicators do NOT require visible panels, but numerical values must never be fabricated.

CANDLE STRUCTURE:
Analyze visible candle sequence first.
Use:
- candle colour
- body size
- wick structure
- repetition
- alternation
- streaks
- mirrored sequences
- split sequences
- sandwich structures
- reversals
- continuation
- expansion/contraction
- rejection
- engulfing
- inside candles
- breakouts
- fake breaks
- liquidity sweeps
- support/resistance reaction
- grid/round-number reaction
- momentum shift
- exhaustion
- HH/HL/LH/LL structure

FINAL DIRECTION:
Choose CALL or PUT only from supported chart evidence.
Do not guarantee a win.

MARTINGALE:
If previous actual confirmed result for the SAME pair is LOSS:
- next direction MUST follow the previous trade direction
- stake = 2x
- this is one-step only
- after that 2x trade wins, reset to 1x
- never automatically create 4x, 8x, etc.

If previous result is WIN:
- Martingale OFF
- stake = 1x

If no confirmed previous result:
- Martingale OFF
- stake = 1x

OUTPUT EXACTLY:

PAIR:
NEXT 1-MINUTE:
TIME:
CONFIDENCE:
DETECTED LOOP:
RULES MATCHED:
RULES NOT CONFIRMED:
VISIBLE PRICE:
MARTINGALE:
PREVIOUS RESULT:
NEXT DIRECTION:
STAKE:
REASON:

Use NOT VISIBLE / NOT CONFIRMED where appropriate.
`;

// ======================================================
// OPENAI IMAGE ANALYSIS
// ======================================================

async function analyzeWithOpenAI(imageBase64, previousResult) {

    const martingaleContext = previousResult
        ? `
PREVIOUS CONFIRMED TRADE FOR SAME PAIR:
Pair: ${previousResult.pair}
Direction: ${previousResult.direction}
Result: ${previousResult.result}
Previous Stake: ${previousResult.stake}

Apply the one-step Martingale rule only if the result is LOSS.
`
        : `
NO CONFIRMED PREVIOUS RESULT FOR THIS PAIR.
Martingale must be OFF and stake must be 1x unless the chart itself provides no basis to invent otherwise.
`;

    const response = await openai.responses.create({
        model: MODEL,
        input: [
            {
                role: "system",
                content: [
                    {
                        type: "input_text",
                        text: PRIVATE_STRATEGY
                    }
                ]
            },
            {
                role: "user",
                content: [
                    {
                        type: "input_text",
                        text:
                            `Analyze this trading chart using the private strategy.\n\n` +
                            martingaleContext +
                            `\nDo not fabricate unavailable numerical data.`
                    },
                    {
                        type: "input_image",
                        image_url: `data:image/jpeg;base64,${imageBase64}`,
                        detail: "high"
                    }
                ]
            }
        ],
        max_output_tokens: 1800
    });

    return response.output_text || "ANALYSIS FAILED";
}

// ======================================================
// SERVER
// ======================================================

const server = http.createServer(async (req, res) => {

    if (req.method === "OPTIONS") {
        return send(res, 200, { ok: true });
    }

    try {

        // --------------------------------------------------
        // HEALTH
        // --------------------------------------------------

        if (req.method === "GET" && req.url === "/") {
            return send(res, 200, {
                ok: true,
                service: "CHALBZAI SERVER",
                version: "4.1.0",
                ai: "OpenAI",
                model: MODEL,
                dailyLimit: DAILY_LIMIT
            });
        }

        // --------------------------------------------------
        // LOGIN
        // --------------------------------------------------

        if (req.method === "POST" && req.url === "/login") {

            const body = await readBody(req);

            const email = clean(body.email).toLowerCase();
            const accessCode = clean(body.accessCode);
            const deviceId = clean(body.deviceId);

            if (!email || !accessCode || !deviceId) {
                return send(res, 400, {
                    ok: false,
                    error: "EMAIL, ACCESS CODE AND DEVICE ID ARE REQUIRED"
                });
            }

            const codes = getAccessCodes();
            const code = codes[accessCode];

            if (!code) {
                return send(res, 401, {
                    ok: false,
                    error: "INVALID ACCESS CODE"
                });
            }

            if (code.active !== true) {
                return send(res, 403, {
                    ok: false,
                    error: "ACCESS CODE IS INACTIVE"
                });
            }

            // --------------------------------------------------
            // EMAIL IS THE PERMANENT OWNER OF THE CODE.
            // DEVICE MISMATCH WILL NO LONGER CAUSE LOGIN FAILURE.
            // CURRENT VALID DEVICE IS REBOUND AUTOMATICALLY.
            // --------------------------------------------------

            if (code.boundEmail && code.boundEmail.toLowerCase() !== email) {
                return send(res, 403, {
                    ok: false,
                    error: "THIS ACCESS CODE IS BOUND TO ANOTHER EMAIL"
                });
            }

            if (!code.boundEmail) {
                code.boundEmail = email;
            }

            // IMPORTANT FIX:
            // Always update the device to the current Android device.
            code.boundDevice = deviceId;

            codes[accessCode] = code;
            writeJson(ACCESS_FILE, codes);

            const users = getUsers();
            const user = getUserDailyInfo(users, email);

            user.accessCode = accessCode;
            user.deviceId = deviceId;

            saveUsers(users);

            return send(res, 200, {
                ok: true,
                email,
                accessCode,
                deviceId,
                dailyUsed: user.dailyUsed,
                dailyLimit: DAILY_LIMIT,
                dailyRemaining: Math.max(0, DAILY_LIMIT - user.dailyUsed)
            });
        }

        // --------------------------------------------------
        // ANALYZE
        // --------------------------------------------------

        if (req.method === "POST" && req.url === "/analyze") {

            const body = await readBody(req);

            const email = clean(body.email).toLowerCase();
            const accessCode = clean(body.accessCode);
            const deviceId = clean(body.deviceId);
            const imageBase64 = clean(body.imageBase64);

            if (!email || !accessCode || !deviceId) {
                return send(res, 400, {
                    ok: false,
                    error: "LOGIN INFORMATION MISSING"
                });
            }

            if (!imageBase64) {
                return send(res, 400, {
                    ok: false,
                    error: "CHART IMAGE MISSING"
                });
            }

            const codes = getAccessCodes();
            const code = codes[accessCode];

            if (!code || code.active !== true) {
                return send(res, 401, {
                    ok: false,
                    error: "INVALID OR INACTIVE ACCESS CODE"
                });
            }

            if (
                code.boundEmail &&
                code.boundEmail.toLowerCase() !== email
            ) {
                return send(res, 403, {
                    ok: false,
                    error: "ACCESS CODE BELONGS TO ANOTHER EMAIL"
                });
            }

            // Same permanent fix:
            // current valid device automatically becomes the active device.
            code.boundEmail = email;
            code.boundDevice = deviceId;

            codes[accessCode] = code;
            writeJson(ACCESS_FILE, codes);

            const users = getUsers();
            const user = getUserDailyInfo(users, email);

            if (user.dailyUsed >= DAILY_LIMIT) {
                saveUsers(users);

                return send(res, 429, {
                    ok: false,
                    error: "DAILY ANALYSIS LIMIT REACHED",
                    dailyUsed: user.dailyUsed,
                    dailyLimit: DAILY_LIMIT,
                    dailyRemaining: 0
                });
            }

            // Previous result can be supplied by app later.
            // Current app normally has no confirmed result.
            let previousResult = null;

            if (body.pair) {
                previousResult = getPreviousResult(email, body.pair);
            }

            const result = await analyzeWithOpenAI(
                imageBase64,
                previousResult
            );

            user.dailyUsed += 1;
            saveUsers(users);

            return send(res, 200, {
                ok: true,
                result,
                dailyUsed: user.dailyUsed,
                dailyLimit: DAILY_LIMIT,
                dailyRemaining: Math.max(
                    0,
                    DAILY_LIMIT - user.dailyUsed
                )
            });
        }

        // --------------------------------------------------
        // CONFIRMED TRADE RESULT
        // --------------------------------------------------

        if (req.method === "POST" && req.url === "/trade-result") {

            const body = await readBody(req);

            const email = clean(body.email).toLowerCase();
            const accessCode = clean(body.accessCode);
            const deviceId = clean(body.deviceId);
            const pair = clean(body.pair).toUpperCase();
            const direction = clean(body.direction).toUpperCase();
            const result = clean(body.result).toUpperCase();
            const stake = Number(body.stake || 1);

            if (!email || !accessCode || !deviceId || !pair) {
                return send(res, 400, {
                    ok: false,
                    error: "MISSING TRADE RESULT DATA"
                });
            }

            if (!["CALL", "PUT"].includes(direction)) {
                return send(res, 400, {
                    ok: false,
                    error: "DIRECTION MUST BE CALL OR PUT"
                });
            }

            if (!["WIN", "LOSS", "DRAW"].includes(result)) {
                return send(res, 400, {
                    ok: false,
                    error: "RESULT MUST BE WIN, LOSS OR DRAW"
                });
            }

            const codes = getAccessCodes();
            const code = codes[accessCode];

            if (!code || code.active !== true) {
                return send(res, 401, {
                    ok: false,
                    error: "INVALID ACCESS CODE"
                });
            }

            if (
                code.boundEmail &&
                code.boundEmail.toLowerCase() !== email
            ) {
                return send(res, 403, {
                    ok: false,
                    error: "ACCESS CODE BELONGS TO ANOTHER EMAIL"
                });
            }

            setTradeResult(
                email,
                pair,
                direction,
                result,
                stake
            );

            return send(res, 200, {
                ok: true,
                message: "CONFIRMED TRADE RESULT SAVED",
                pair,
                direction,
                result,
                stake
            });
        }

        // --------------------------------------------------
        // 404
        // --------------------------------------------------

        return send(res, 404, {
            ok: false,
            error: "NOT FOUND"
        });

    } catch (err) {

        console.log("SERVER ERROR:", err);

        return send(res, 500, {
            ok: false,
            error: err.message || "SERVER ERROR"
        });
    }
});

// ======================================================
// START
// ======================================================

server.listen(PORT, "0.0.0.0", () => {

    console.log("");
    console.log("==============================================");
    console.log("          CHALBZAI SERVER ONLINE");
    console.log("==============================================");
    console.log("Version: 4.1.0");
    console.log("Port:", PORT);
    console.log("URL: http://localhost:" + PORT);
    console.log("AI: OpenAI");
    console.log("Model:", MODEL);
    console.log("Daily limit:", DAILY_LIMIT);
    console.log("Strategy: 20 LOOPS + 12 CORE RULES");
    console.log("Indicators: RSI5 + MACD(3,9,3) + ATR5");
    console.log("Chart indicator panels required: NO");
    console.log("Martingale: 1-step 2x after confirmed LOSS");
    console.log("Device mismatch login: AUTO-REBIND");
    console.log("==============================================");
    console.log("");
});