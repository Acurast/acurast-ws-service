const getError = (code: number, message: string) => ({
  code,
  message
})

export const validateConnection = (connectedClients: Map<string, any>, ipAddr?: string) => {
  if (!ipAddr) {
    return getError(1008, 'No ip address received.')
  }

  if (connectedClients.has(ipAddr)) {
    return getError(1008, 'The client has already a connection open.')
  }

  return undefined
}
