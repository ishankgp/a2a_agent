"""
Test Gamma API - Full Flow with Polling
"""
import os
import time
import httpx
from dotenv import load_dotenv

load_dotenv()

gamma_key = os.getenv("GAMMA_API_KEY")
base_url = "https://public-api.gamma.app/v1.0"

payload = {
    "inputText": "Create a brief presentation about diabetes management for patients",
    "textMode": "generate",
    "format": "presentation",
    "numCards": 3
}

headers = {"X-API-KEY": gamma_key, "Content-Type": "application/json"}

print("=== Gamma API Full Test ===\n")
print(f"Creating presentation...")

with httpx.Client(timeout=60.0) as client:
    # 1. Start generation
    resp = client.post(f"{base_url}/generations", json=payload, headers=headers)
    print(f"Create Status: {resp.status_code}")
    
    if resp.status_code != 201:
        print(f"ERROR: {resp.text}")
        exit(1)
    
    job_data = resp.json()
    print(f"Job Data: {job_data}")
    job_id = job_data.get("id")
    print(f"Job ID: {job_id}")
    
    # 2. Poll for completion
    print("\nPolling for completion...")
    for i in range(30):  # Max 60 seconds
        time.sleep(2)
        poll_resp = client.get(f"{base_url}/generations/{job_id}", headers=headers)
        print(f"Poll {i+1}: Status {poll_resp.status_code}")
        
        if poll_resp.status_code == 200:
            poll_data = poll_resp.json()
            print(f"  Data: {poll_data}")
            
            status = poll_data.get("status")
            print(f"  Generation Status: {status}")
            
            if status == "completed":
                url = poll_data.get("url")
                print(f"\n✅ SUCCESS! URL: {url}")
                break
            elif status == "failed":
                print(f"\n❌ FAILED: {poll_data}")
                break
        else:
            print(f"  Error: {poll_resp.text}")
            
    print("\n=== Test Complete ===")
