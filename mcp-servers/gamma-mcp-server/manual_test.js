
const API_KEY = "sk-gamma-RFoahtjtWQYabKLHdGJoXxNtvRmieFhvt6JtzE8pH0";

async function run() {
    console.log("Starting generation...");
    // 1. Generate
    // Endpoint: https://public-api.gamma.app/v1.0/generations (from app.py)
    const genRes = await fetch("https://public-api.gamma.app/v1.0/generations", {
        method: "POST",
        headers: {
            "X-API-KEY": API_KEY, // app.py uses X-API-KEY, index.js used Authorization Bearer. I should try both or stick to app.py which works. app.py uses X-API-KEY.
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            inputText: "Create a presentation about the future of AI agents.",
            textMode: "generate",
            format: "presentation",
            numCards: 7 // matching app.py example
        })
    });

    if (!genRes.ok) {
        console.error("Gen failed", genRes.status, await genRes.text());
        return;
    }

    const genData = await genRes.json();
    console.log("Generation started. Job Data:", genData);

    const jobId = genData.generationId; // app.py says 'generationId'

    if (!jobId) {
        console.error("No job ID found in response:", genData);
        return;
    }

    // 2. Poll
    let attempts = 0;
    while (attempts < 60) {
        await new Promise(r => setTimeout(r, 2000));
        attempts++;

        // Endpoint: https://public-api.gamma.app/v1.0/generations/{id}
        const statusRes = await fetch(`https://public-api.gamma.app/v1.0/generations/${jobId}`, {
            headers: { "X-API-KEY": API_KEY }
        });

        if (!statusRes.ok) {
            console.log("Status check failed:", statusRes.status);
            continue;
        }

        const statusData = await statusRes.json();
        console.log(`Attempt ${attempts}: Status = ${statusData.status}`);

        if (statusData.status === "completed" || statusData.status === "CMS_COMPLETED" || statusData.status === "DONE") {
            console.log("Success! URL:", statusData.url);
            break;
        }
        if (statusData.status === "failed" || statusData.status === "ERROR") {
            console.error("Failed:", statusData);
            break;
        }
    }
}

run();
