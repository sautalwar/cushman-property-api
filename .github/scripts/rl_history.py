import json, random, math, os

random.seed(42)

# Realistic 24-hour baseline (req/min) — peaks at business hours
baseline = [8,5,4,3,3,4,12,28,45,52,48,55,62,58,54,48,45,42,38,30,24,18,14,10]

users = {
    'alice@propowner.com':     [max(0,int(b*0.25+random.gauss(0,2))) for b in baseline],
    'bob@propowner.com':       [max(0,int(b*0.20+random.gauss(0,1))) for b in baseline],
    'charlie@plumbing.com':    [max(0,int(b*0.15+random.gauss(0,1))) for b in baseline],
    'diana@electric.com':      [max(0,int(b*0.12+random.gauss(0,1))) for b in baseline],
    'api_bot@proptracker.com': [max(0,int(b*0.10+random.gauss(0,1))) for b in baseline],
    'unknown@attacker.io':     [random.randint(280,450) if 14<=h<=17 else random.randint(0,2) for h in range(24)],
}

total = [sum(users[u][h] for u in users) for h in range(24)]
atk_total = sum(users['unknown@attacker.io'])

out = os.environ.get('GITHUB_OUTPUT','/tmp/gho.txt')
with open(out,'a') as f:
    f.write(f"peak_hour={total.index(max(total))}\n")
    f.write(f"peak_requests={max(total)}\n")
    f.write(f"attacker_total={atk_total}\n")

with open('/tmp/history.json','w') as f:
    json.dump({'total':total,'users':users,'baseline':baseline},f)

print(f"Peak: {max(total)} req/min at {total.index(max(total))}:00")
print(f"Attacker total: {atk_total} requests across 24h")
