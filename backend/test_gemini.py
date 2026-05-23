import os
import sys
import json
from dotenv import load_dotenv

load_dotenv()

api_key = os.environ.get("GEMINI_API_KEY", "")
print(f"[1] API Key found: {bool(api_key)} — starts with: {api_key[:15]}...")

try:
    import google.generativeai as genai
    print("[2] google-generativeai imported OK")
except ImportError as e:
    print(f"[2] IMPORT ERROR: {e}")
    sys.exit(1)

genai.configure(api_key=api_key)

candidate_models = [
    "gemini-2.5-flash",
    "gemini-3.5-flash",
    "gemini-2.0-flash-lite",
    "gemini-flash-latest",
    "gemini-flash-lite-latest",
    "gemini-pro-latest",
    "gemini-2.0-flash",
]

for model_name in candidate_models:
    print(f"\n--- Testing model: {model_name} ---")
    try:
        model = genai.GenerativeModel(
            model_name=model_name,
            generation_config=genai.types.GenerationConfig(
                temperature=0.2,
                max_output_tokens=256,
            ),
        )
        response = model.generate_content("Say only: hello")
        print(f"SUCCESS with {model_name}! Response: {response.text.strip()}")
        sys.exit(0)
    except Exception as e:
        print(f"FAILED with {model_name}: {type(e).__name__}: {e}")

print("\n[!] All candidate models failed.")
sys.exit(1)
