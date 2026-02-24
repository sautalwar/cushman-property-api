import json, time

with open('/tmp/runtime_findings.json') as f:
    data = json.load(f)

findings = data.get('findings', [])

# SARIF severity mapping
sev_map = {'critical': 'error', 'high': 'error', 'medium': 'warning', 'low': 'note'}

# Build SARIF 2.1.0 document
sarif = {
    "version": "2.1.0",
    "$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
    "runs": [{
        "tool": {
            "driver": {
                "name": "PropTracker Runtime API Security Probe",
                "version": "1.0.0",
                "informationUri": "https://github.com/sautalwar/cushman-property-api",
                "rules": [
                    {
                        "id": f["id"],
                        "name": f["id"].replace("-", ""),
                        "shortDescription": {"text": f["rule"]},
                        "fullDescription": {"text": f["message"]},
                        "helpUri": "https://owasp.org/API-Security/",
                        "properties": {"security-severity": "9.0" if f["severity"] == "critical" else "7.0" if f["severity"] == "high" else "5.0"}
                    }
                    for f in findings
                ]
            }
        },
        "results": [
            {
                "ruleId": f["id"],
                "level": sev_map.get(f["severity"], "warning"),
                "message": {"text": f"{f['message']} Fix: {f['fix']}"},
                "locations": [{
                    "physicalLocation": {
                        "artifactLocation": {"uri": f["file"], "uriBaseId": "%SRCROOT%"},
                        "region": {"startLine": f["line"]}
                    }
                }]
            }
            for f in findings
        ],
        "automationDetails": {"id": f"runtime-probe/{int(time.time())}"}
    }]
}

with open('/tmp/results.sarif', 'w') as f:
    json.dump(sarif, f, indent=2)

print(f"SARIF generated with {len(findings)} result(s)")
