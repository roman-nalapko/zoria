import { ApiTransport } from '../api/transport'
import { readAppConfig } from '../config/environment'
import { EtherController } from '../ether/controller'

export const appConfig = readAppConfig()
export const etherController = new EtherController(
  new ApiTransport(appConfig.apiUrl),
  appConfig.etherKeyFingerprint,
)
