param swaName string
param location string = 'eastus2'

resource staticWebApp 'Microsoft.Web/staticSites@2023-01-01' = {
  name: swaName
  location: location
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    buildProperties: {
      appLocation: 'frontend'
      outputLocation: 'dist'
    }
  }
}

output defaultHostname string = staticWebApp.properties.defaultHostname
output swaId string = staticWebApp.id