import { ApiTransport } from '../api/transport'
import { clearSession, getToken } from '../auth/session-vault'
import { readAppConfig } from '../config/environment'
import { EtherController } from '../ether/controller'

export const appConfig = readAppConfig()
export const apiTransport = new ApiTransport(appConfig.apiUrl, {
  onUnauthorized: () => {
    clearSession()
  },
  tokenProvider: () => getToken(),
})
export const etherController = new EtherController(
  apiTransport,
  appConfig.etherKeyFingerprint,
)
