const key = (address: string) => `mymarkets_${address.toLowerCase()}`

export function getMyMarketIds(address: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(key(address)) || "[]"))
  } catch {
    return new Set()
  }
}

export function addMyMarketId(address: string, id: string): void {
  const ids = getMyMarketIds(address)
  if (ids.has(id)) return
  ids.add(id)
  localStorage.setItem(key(address), JSON.stringify([...ids]))
}
