@description('Azure region for all resources')
param location string = resourceGroup().location

@description('Name prefix for all resources')
param namePrefix string = 'proptracker'

@description('Container registry name')
param acrName string

@description('API Docker image tag (commit SHA)')
param apiImageTag string = 'latest'

@description('PostgreSQL administrator password')
@secure()
param databasePassword string

@description('JWT signing secret')
@secure()
param jwtSecret string

// Container Registry
module acr 'modules/acr.bicep' = {
  name: 'acr-deploy'
  params: {
    acrName: acrName
    location: location
  }
}

// PostgreSQL Flexible Server
module postgres 'modules/postgres.bicep' = {
  name: 'postgres-deploy'
  params: {
    serverName: '${namePrefix}-db'
    location: location
    administratorLogin: 'proptracker_admin'
    administratorPassword: databasePassword
  }
}

// Key Vault
module keyvault 'modules/keyvault.bicep' = {
  name: 'keyvault-deploy'
  params: {
    kvName: '${namePrefix}-kv'
    location: location
    databasePassword: databasePassword
    jwtSecret: jwtSecret
    dbConnectionString: 'postgresql://proptracker_admin:${databasePassword}@${postgres.outputs.fqdn}:5432/proptracker'
  }
}

// App Service (API)
module appService 'modules/app-service.bicep' = {
  name: 'api-deploy'
  params: {
    appName: '${namePrefix}-api'
    location: location
    acrLoginServer: acr.outputs.loginServer
    imageName: 'proptracker-api'
    imageTag: apiImageTag
    databaseUrl: 'postgresql://proptracker_admin:${databasePassword}@${postgres.outputs.fqdn}:5432/proptracker'
    jwtSecret: jwtSecret
  }
}

// Static Web App (React frontend)
module swa 'modules/static-webapp.bicep' = {
  name: 'swa-deploy'
  params: {
    swaName: '${namePrefix}-frontend'
    location: location
  }
}

output apiUrl string = 'https://${appService.outputs.defaultHostname}'
output frontendUrl string = swa.outputs.defaultHostname