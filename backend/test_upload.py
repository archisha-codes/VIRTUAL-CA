import requests

url = "http://127.0.0.1:8000/api/v1/gstr1/upload"
files = {
    "file": ("test.xlsx", b"dummy content", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
}
data = {
    "mapping": "{}",
    "workspace_id": "test_workspace",
    "company_gstin": "TEST",
    "return_period": "052026"
}
# First login to get a valid token
auth_response = requests.post("http://127.0.0.1:8000/api/auth/dev-login")
if auth_response.status_code == 200:
    token = auth_response.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.post(url, files=files, data=data, headers=headers)
    print(resp.status_code)
    print(resp.text)
else:
    print("Dev login failed")
