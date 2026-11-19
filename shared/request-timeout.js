export function getRequestTimeout(model) {
  if (model === 'lite') return 25000
  if (model === 'flash38') return 45000
  return 120000 // hydrogen or default
}

export function withTimeout(run, ms) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Request timed out')), ms)
  })
  return Promise.race([Promise.resolve().then(run), timeout]).finally(() => clearTimeout(timer))
}
