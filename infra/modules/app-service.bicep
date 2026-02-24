param appName string
param location string
param acrLoginServer string
param imageName string
param imageTag string

@secure()
param databaseUrl string

@secure()
param jwtSecret string

resource appServicePlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: '${appName}-plan'
  location: location
  kind: 'linux'
  sku: {
    name: 'B1'
    tier: 'Basic'
  }
  properties: {
    reserved: true
  }
}

resource webApp 'Microsoft.Web/sites@2023-01-01' = {
  name: appName
  location: location
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'DOCKER|${acrLoginServer}/${imageName}:${imageTag}'
      appSettings: [
        { name: 'DATABASE_URL', value: databaseUrl }
        { name: 'JWT_SECRET', value: jwtSecret }
        { name: 'NODE_ENV', value: 'production' }
        { name: 'PORT', value: '3001' }
        { name: 'WEBSITES_PORT', value: '3001' }
      ]
    }
  }
}

output defaultHostname string = webApp.properties.defaultHostName
output webAppId string = webApp.id