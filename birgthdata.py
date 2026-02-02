import requests

url = "https://api.brightdata.com/datasets/v3/trigger"
headers = {
	"Authorization": "Bearer 33d2b0e0fee53e66ec84cd431b78e423d4960d7f5a7080b5a56b8ee913e9161e",
	"Content-Type": "application/json",
}
params = {
	"dataset_id": "gd_lk56epmy2i5g7lzu0k",
	"include_errors": "true",
	"type": "discover_new",
	"discover_by": "keyword",
}
data = [
	{"keyword":"popular music","num_of_posts":"10","start_date":"01-01-2024","end_date":"03-31-2024","country":""},
	{"keyword":"top videos","num_of_posts":"5","start_date":"04-01-2024","end_date":"06-30-2024","country":""},
	{"keyword":"best volleyball plays","num_of_posts":"","start_date":"","end_date":"","country":""},
]

response = requests.post(url, headers=headers, params=params, json=data)
print(response.json())