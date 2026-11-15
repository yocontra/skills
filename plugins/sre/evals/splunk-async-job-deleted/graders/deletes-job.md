---
type: regex
target: last_message
pattern: 'DELETE[^\n]*search/(v2/)?jobs|method="DELETE"|-X DELETE[^\n]*jobs'
match: contains
---
