export function getRequestTimeout(model) {
  return model === 'lite' ? 25000 : 120000
}

export function withTimeout(run, ms) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Request timed out')), ms)
  })
  return Promise.race([Promise.resolve().then(run), timeout]).finally(() => clearTimeout(timer))
}
