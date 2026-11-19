import { str2buf, buf2str } from './data'

const STORAGE_FILE = 'gemini_state.json'

let memoryStore = null

export function saveState(data) {
  try {
    memoryStore = JSON.parse(JSON.stringify(data))
    if (typeof hmFS === 'undefined' || !hmFS.open) {
      return true
    }
    const jsonStr = JSON.stringify(data)
    const buf = str2buf(jsonStr)
    const arrayBuf = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
    const file = hmFS.open(STORAGE_FILE, hmFS.O_CREAT | hmFS.O_RDWR | hmFS.O_TRUNC)
    if (file < 0) return false
    hmFS.seek(file, 0, hmFS.SEEK_SET)
    hmFS.write(file, arrayBuf, 0, arrayBuf.byteLength)
    hmFS.close(file)
    return true
  } catch (e) {
    console.log('[Storage Save Error]', e)
    return false
  }
}

export function loadState() {
  try {
    if (typeof hmFS === 'undefined' || !hmFS.open) {
      return memoryStore ? JSON.parse(JSON.stringify(memoryStore)) : null
    }
    let stat = null
    if (typeof hmFS.stat === 'function') {
      const res = hmFS.stat(STORAGE_FILE)
      if (Array.isArray(res)) {
        if (res[1] === 0) stat = res[0]
      } else if (res && typeof res.size === 'number') {
        stat = res
      }
    }
    if (!stat || stat.size <= 0) {
      return memoryStore ? JSON.parse(JSON.stringify(memoryStore)) : null
    }
    const buffer = new ArrayBuffer(stat.size)
    const file = hmFS.open(STORAGE_FILE, hmFS.O_RDONLY)
    if (file < 0) return null
    hmFS.seek(file, 0, hmFS.SEEK_SET)
    hmFS.read(file, buffer, 0, stat.size)
    hmFS.close(file)
    const jsonStr = buf2str(Buffer.from(buffer))
    return JSON.parse(jsonStr)
  } catch (e) {
    console.log('[Storage Load Error]', e)
    return memoryStore ? JSON.parse(JSON.stringify(memoryStore)) : null
  }
}

export function resetMemoryStoreForTest() {
  memoryStore = null
}
