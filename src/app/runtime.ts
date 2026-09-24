import { ApiTransport } from '../api/transport'
import { readAppConfig } from '../config/environment'
import { EtherController } from '../ether/controller'

export const appConfig = readAppConfig()
export const apiTransport = new ApiTransport(appConfig.apiUrl)
export const etherController = new EtherController(
  apiTransport,
  appConfig.etherKeyFingerprint,
)
