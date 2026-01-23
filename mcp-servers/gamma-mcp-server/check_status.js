
const API_KEY = "sk-gamma-RFoahtjtWQYabKLHdGJoXxNtvRmieFhvt6JtzE8pH0";
const JOB_ID = "RwXGsm93WnnJlZDFAZ6TP";

async function run() {
    console.log(`Checking status for ${JOB_ID}...`);
    const statusRes = await fetch(`https://public-api.gamma.app/v1.0/generations/${JOB_ID}`, {
        headers: { "X-API-KEY": API_KEY }
    });
    const statusData = await statusRes.json();
    console.log(JSON.stringify(statusData, null, 2));
}

run();
