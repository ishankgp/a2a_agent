import os
import google.generativeai as genai
from dotenv import load_dotenv

# Load env
print("Loading .env...")
load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
print(f"Key loaded: {api_key[:10]}...{api_key[-5:] if api_key else 'None'}")

if not api_key:
    print("ERROR: GEMINI_API_KEY not found in environment.")
    exit(1)

print("\nConfiguring Gemini...")
try:
    genai.configure(api_key=api_key)
    
    print("Listing models to verify connection...")
    try:
        models = [m.name for m in genai.list_models() if 'generateContent' in m.supported_generation_methods]
        print(f"Found {len(models)} models: {models[:3]}...")
    except Exception as e:
        print(f"Listing models failed: {e}")
        # Continue to try generation anyway, sometimes list is restricted but generation works

    print("\nAttempting generation with 'gemini-pro'...")
    model = genai.GenerativeModel('gemini-pro')
    response = model.generate_content("Hello, can you confirm this API key is working?")
    
    print("\n--- RESPONSE ---")
    print(response.text)
    print("----------------")
    print("\nSUCCESS: API Key is valid and working.")

except Exception as e:
    print("\n!!! FAILURE !!!")
    print(f"API Error: {e}")
    print("Possible causes: Expired key, Quota exceeded, or Billing disabled.")
