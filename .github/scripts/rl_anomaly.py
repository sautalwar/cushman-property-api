import json, math, os

with open('/tmp/history.json') as f:
    data = json.load(f)

total = data['total']
mean = sum(total)/len(total)
variance = sum((x-mean)**2 for x in total)/len(total)
std = math.sqrt(variance)

anomalies = [(h, v, round((v-mean)/max(std,1),1)) for h,v in enumerate(total) if (v-mean)/max(std,1) > 2.5]
normal_peak = max(v for h,v in enumerate(total) if h < 14)
recommended = max(15, int(normal_peak * 1.5))
strict = max(10, int(normal_peak * 1.0))

out = os.environ.get('GITHUB_OUTPUT','/tmp/gho.txt')
with open(out,'a') as f:
    f.write(f"anomaly_count={len(anomalies)}\n")
    f.write(f"mean={mean:.1f}\n")
    f.write(f"std={std:.1f}\n")
    f.write(f"recommended_limit={recommended}\n")
    f.write(f"strict_limit={strict}\n")
    f.write("anomaly_hours="+",".join(str(h) for h,_,_ in anomalies)+"\n")

with open('/tmp/anomaly.json','w') as f:
    json.dump({'mean':mean,'std':std,'anomalies':[[h,v,z] for h,v,z in anomalies],'recommended':recommended,'strict':strict},f)

print(f"Mean: {mean:.1f} | Std: {std:.1f} | Anomalies: {len(anomalies)} windows")
print(f"Anomaly hours: {[h for h,_,_ in anomalies]}")
print(f"AI recommended limit: {recommended} req/min per user")
