import urllib.request
import json
import time

API_URL = "http://127.0.0.1:8000/api/review/github"

test_cases = [
    {
        "name": "Small PR (axios #6186)",
        "payload": {"pr_url": "https://github.com/axios/axios/pull/6186"}
    },
    {
        "name": "Fizz PR (react #33016)",
        "payload": {"pr_url": "https://github.com/facebook/react/pull/33016"}
    },
    {
        "name": "Non-existent PR (test/test #999999)",
        "payload": {"pr_url": "https://github.com/test/test/pull/999999"}
    }
]

for case in test_cases:
    print(f"\n==========================================")
    print(f"🚀 Running Test Case: {case['name']}")
    print(f"Payload: {case['payload']}")
    print(f"==========================================")
    
    start_time = time.time()
    req = urllib.request.Request(
        API_URL,
        data=json.dumps(case['payload']).encode(),
        headers={"Content-Type": "application/json"}
    )
    
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            duration = time.time() - start_time
            print(f"✅ SUCCESS (Time: {duration:.2f}s)")
            print(f"Score: {data.get('overall_score')}/100")
            print(f"Grade: {data.get('grade')}")
            print(f"Summary: {data.get('summary')}")
            print(f"PR Title: {data.get('pr_info', {}).get('title')}")
            print(f"Files Count: {data.get('pr_info', {}).get('changed_files')}")
            print(f"Issues Found: {len(data.get('issues', []))}")
    except Exception as e:
        duration = time.time() - start_time
        print(f"❌ ERROR (Time: {duration:.2f}s)")
        print(f"Exception: {type(e).__name__}: {e}")
        if hasattr(e, 'read'):
            body = e.read().decode()
            try:
                err_json = json.loads(body)
                print(f"Server Error Detail: {err_json.get('detail')}")
            except Exception:
                print(f"Raw Server Response: {body[:300]}")
