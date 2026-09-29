const http = require("http");

const PORT = 3000;

// Gemini API key yahan DIRECT mat likhna.
// Baad mein Windows environment variable se set karenge.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

const ACCESS_CODE = "CHALBZAI2026";

function send(res, status, data) {
    res.writeHead(status, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
    });

    res.end(JSON.stringify(data));
}

async function analyzeWithGemini(imageBase64, mimeType, prompt) {

    if (!GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is not configured on server.");
    }

    const url =
        "https://generativelanguage.googleapis.com/" +
        "v1beta/models/gemini-3.8-flash:generateContent";

    const body = {
        contents: [
            {
                parts: [
                    {
                        text: prompt
                    },
                    {
                        inline_data: {
                            mime_type: mimeType || "image/jpeg",
                            data: imageBase64
                        }
                    }
                ]
            }
        ],
        generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2500
        }
    };

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": GEMINI_API_KEY
        },
        body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data?.error?.message || "Gemini API request failed."
        );
    }

    const text =
        data?.candidates?.[0]?.content?.parts
            ?.map(p => p.text || "")
            .join("") || "";

    return text;
}

const server = http.createServer(async (req, res) => {

    // CORS preflight
    if (req.method === "OPTIONS") {
        res.writeHead(204, {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
        });
        res.end();
        return;
    }

    // Health check
    if (req.method === "GET" && req.url === "/") {
        send(res, 200, {
            status: "ONLINE",
            server: "ChalbzAI_Server",
            version: "1.0.0"
        });
        return;
    }

    // Chart analysis
    if (req.method === "POST" && req.url === "/analyze") {

        let rawBody = "";

        req.on("data", chunk => {
            rawBody += chunk;

            // Basic protection against extremely large requests
            if (rawBody.length > 15 * 1024 * 1024) {
                req.destroy();
            }
        });

        req.on("end", async () => {

            try {

                const request = JSON.parse(rawBody);

                // Access-code protection
                if (request.accessCode !== ACCESS_CODE) {
                    send(res, 401, {
                        success: false,
                        error: "INVALID ACCESS CODE"
                    });
                    return;
                }

                if (!request.imageBase64) {
                    send(res, 400, {
                        success: false,
                        error: "IMAGE REQUIRED"
                    });
                    return;
                }

                const prompt = request.prompt || `
You are ChalbzAI chart analysis engine.

Analyze ONLY the information visible in the supplied chart image.

Determine:
1. Higher High (HH)
2. Higher Low (HL)
3. Lower High (LH)
4. Lower Low (LL)

Analyze candle colour sequence and the 20 loops.

20 LOOPS:
1. Streak
2. Alternating
3. Mirror
4. Split
5. Sandwich
6. Reversal
7. Continuation
8. Expansion
9. Contraction
10. Wick-Rejection
11. Engulfing
12. Inside-Candle
13. Breakout
14. Fake-Break
15. Liquidity-Sweep
16. Support-Rejection
17. Resistance-Rejection
18. Grid/Round-Number
19. Momentum-Shift
20. Exhaustion

CUSTOM 12 RULES:

1. MICRO-SEQUENCE SYMMETRY
Last 5 candles.
Mirror Loop = G-G-R-G-G.
Split Loop = G-R-G-R-G.

2. ARTIFICIAL OPENING GAP SKEW
Gap above previous close = stop-loss hunt and counter-strike priority.

3. LAST 3-SECOND VELOCITY VECTOR
Violent final 3-second spike = continuation.

4. WICK-TO-BODY VOLATILITY RATIO
At key grid, rejection wick >60% of total candle size = momentum rejected.

5. GRID LEVEL MAGNET THEORY
Within 3 pips of .000 or .500 = grid magnet / touch-before-reversal behavior.

6. HYPER-SENSITIVE RSI 5 CORE
RSI5 >85 + top wick = PUT.
RSI5 <15 + bottom wick = CALL.
RSI5 breaks 50 with high velocity = continuation.

7. ULTRA-FAST MACD CLUSTER
MACD (3,9,3).
Sharp histogram flip above zero = CALL continuation.
Dead-cross deep in overbought = aggressive PUT.

8. ATR5 VOLATILITY MATRIX
Current candle >2x ATR5 = Volume Exhaustion Climax and next-candle reversal expectation.

9. VOLUME-SIZE DIVERGENCE TRAP
Smaller body while market velocity increases = algorithmic reversal loop.

10. BROKER SLIPPAGE BUFFER CHECK
Calculate entry timing using 1-second broker transmission delay.

11. STRUCTURAL MICRO-TREND FLOW
Use last 15 candles for macro directional bias.

12. MARTINGALE RECOVERY FLOW (M1)
Only if previous trade result is actually available as LOSS.
Calculate correction versus streak continuation for next candle.

For every rule:
Return DETECTED only when the required condition is actually visible or available.
Otherwise return NOT DETECTED.
Never invent RSI, MACD, ATR, volume, velocity, gap, price or timing values.

Return the result in this structure:

MARKET STRUCTURE
HH:
HL:
LH:
LL:

CANDLE SEQUENCE:

20 LOOP ENGINE:
1:
2:
3:
4:
5:
6:
7:
8:
9:
10:
11:
12:
13:
14:
15:
16:
17:
18:
19:
20:

12 RULES STATUS:
1:
2:
3:
4:
5:
6:
7:
8:
9:
10:
11:
12:

NEXT 1-MINUTE SIGNAL:
CALL or PUT

REASON:

CONFIDENCE:

VISIBLE PRICE:

VISIBLE PAIR:

Do not claim certainty or guarantee a winning trade.
`;

                const result = await analyzeWithGemini(
                    request.imageBase64,
                    request.mimeType,
                    prompt
                );

                send(res, 200, {
                    success: true,
                    result: result
                });

            } catch (error) {

                send(res, 500, {
                    success: false,
                    error: error.message || "SERVER ERROR"
                });

            }
        });

        return;
    }

    send(res, 404, {
        success: false,
        error: "NOT FOUND"
    });
});

server.listen(PORT, () => {
    console.log("");
    console.log("=================================");
    console.log("     ChalbzAI Server ONLINE");
    console.log("=================================");
    console.log("Port:", PORT);
    console.log("URL: http://localhost:" + PORT);
    console.log("");
});