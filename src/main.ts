import './style.css'
import titleBg from './assets/title.avif'
import brushImgSrc from './assets/zoukin.png'

const GAME_TIME_MS = 20_000
const SAMPLE_INTERVAL_MS = 100
const BRUSH_SIZE = 100
const APP_BG_COLOR = '#aab5c5'
const LAYER_CLEAR_THRESHOLD = 82
const STAGE_WIDTH_RATIO = 0.84
const STAGE_HEIGHT_RATIO = 0.8
const STAGE_MAX_WIDTH = 760
const STAGE_MAX_HEIGHT = 520
const SHARE_URL = 'https://kosora623.github.io/zoukin_challenge/'

const timerEl = document.getElementById('timer') as HTMLSpanElement
const scoreEl = document.getElementById('score') as HTMLSpanElement
const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement
const resultOverlay = document.getElementById('resultOverlay') as HTMLDivElement
const finalScoreEl = document.getElementById('finalScore') as HTMLSpanElement
let retryBtn = document.getElementById('retryBtn') as HTMLButtonElement | null
let shareBtn = document.getElementById('shareBtn') as HTMLButtonElement | null
const uiContainer = document.querySelector('.ui-container') as HTMLDivElement | null

if (!canvas || !timerEl || !scoreEl || !resultOverlay || !finalScoreEl) {
  throw new Error('必要な要素が見つかりません。index.html を確認してください。')
}

if (!retryBtn) {
  const fallbackRetryBtn = document.createElement('button')
  fallbackRetryBtn.id = 'retryBtn'
  fallbackRetryBtn.type = 'button'
  fallbackRetryBtn.textContent = 'リトライ'
  const resultBox = resultOverlay.querySelector('.result-box')
  resultBox?.appendChild(fallbackRetryBtn)
  retryBtn = fallbackRetryBtn
}

if (!shareBtn) {
  const fallbackShareBtn = document.createElement('button')
  fallbackShareBtn.id = 'shareBtn'
  fallbackShareBtn.type = 'button'
  fallbackShareBtn.textContent = '共有'
  const resultActions = resultOverlay.querySelector('.result-actions')
  if (resultActions) {
    resultActions.appendChild(fallbackShareBtn)
  } else {
    const resultBox = resultOverlay.querySelector('.result-box')
    resultBox?.appendChild(fallbackShareBtn)
  }
  shareBtn = fallbackShareBtn
}

const layerStatusEl = document.createElement('div')
layerStatusEl.className = 'ui-item layer-badge'
layerStatusEl.textContent = 'LAYER 1/3'
uiContainer?.appendChild(layerStatusEl)

const ctx = canvas.getContext('2d')!
const backgroundCanvas = document.createElement('canvas')
const backgroundCtx = backgroundCanvas.getContext('2d')!
const dirtLayers: DirtLayer[] = []
let stageRect = { x: 0, y: 0, width: 0, height: 0 }

const titleOverlay = document.createElement('div')
titleOverlay.className = 'title-overlay'
titleOverlay.setAttribute('aria-hidden', 'false')
titleOverlay.innerHTML = `
  <div class="title-panel" id="titlePanel" style="background-image: url('${titleBg}')">
    <div class="title-glow"></div>
    <button id="startBtn" class="start-button" type="button">スタート</button>
  </div>
`
document.body.appendChild(titleOverlay)

const titlePanel = titleOverlay.querySelector<HTMLDivElement>('#titlePanel')
const startBtn = titleOverlay.querySelector<HTMLButtonElement>('#startBtn')
if (!titlePanel || !startBtn) {
  throw new Error('titlePanel/startBtn を生成できませんでした。')
}

let devicePixelRatioVal = Math.max(1, window.devicePixelRatio || 1)

interface DirtLayer {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  progress: number
  cleared: boolean
  fillStyle: string
  opacity: number
}

function createLayer(fillStyle: string, opacity: number): DirtLayer {
  const layerCanvas = document.createElement('canvas')
  const layerCtx = layerCanvas.getContext('2d')!
  return {
    canvas: layerCanvas,
    ctx: layerCtx,
    progress: 0,
    cleared: false,
    fillStyle,
    opacity,
  }
}

function buildDirtLayers(width: number, height: number) {
  dirtLayers.length = 0
  dirtLayers.push(
    createLayer('rgba(80, 50, 30, 0.92)', 1),
    createLayer('rgba(95, 64, 38, 0.78)', 0.92),
    createLayer('rgba(120, 88, 54, 0.62)', 0.85),
  )

  for (const layer of dirtLayers) {
    layer.canvas.width = width
    layer.canvas.height = height
    layer.ctx.setTransform(devicePixelRatioVal, 0, 0, devicePixelRatioVal, 0, 0)
  }

  paintDirtLayers()
}

function paintDirtLayers() {
  dirtLayers.forEach((layer, index) => {
    layer.ctx.setTransform(1, 0, 0, 1, 0, 0)
    layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height)
    layer.ctx.setTransform(devicePixelRatioVal, 0, 0, devicePixelRatioVal, 0, 0)
    layer.ctx.fillStyle = layer.fillStyle
    layer.ctx.fillRect(stageRect.x, stageRect.y, stageRect.width, stageRect.height)

    // それぞれ少し違う汚れ感を出す
    layer.ctx.globalAlpha = 0.18 + index * 0.07
    layer.ctx.fillStyle = index === 0 ? '#2d1d10' : index === 1 ? '#62422b' : '#8d6b4b'
    for (let y = stageRect.y - 20; y < stageRect.y + stageRect.height + 40; y += 42) {
      for (let x = stageRect.x - 20; x < stageRect.x + stageRect.width + 40; x += 58) {
        const wobbleX = (Math.sin((x + y + index * 91) * 0.18) * 9)
        const wobbleY = (Math.cos((x - y + index * 57) * 0.16) * 7)
        const noise = (x * 13 + y * 7 + index * 31) % 16
        const radius = 10 + ((noise + 16) % 16)
        layer.ctx.beginPath()
        layer.ctx.ellipse(x + wobbleX, y + wobbleY, radius * 1.15, radius * 0.7, (x + y) * 0.02, 0, Math.PI * 2)
        layer.ctx.fill()
      }
    }
    layer.ctx.globalAlpha = 1

    // 上層ほど少し粗いノイズを足す
    layer.ctx.globalAlpha = 0.16 + index * 0.05
    layer.ctx.fillStyle = '#ffffff'
    for (let i = 0; i < 380; i++) {
      const nx = stageRect.x + ((i * 97 + index * 193) % Math.max(1, stageRect.width))
      const ny = stageRect.y + ((i * 53 + index * 157) % Math.max(1, stageRect.height))
      const size = (i % 3) + 1
      layer.ctx.fillRect(nx, ny, size, size)
    }
    layer.ctx.globalAlpha = 1
  })
}

function resize() {
  const w = Math.min(window.innerWidth - 40, 900)
  const h = Math.min(window.innerHeight - 160, 700)

  canvas.style.width = `${w}px`
  canvas.style.height = `${h}px`

  canvas.width = Math.floor(w * devicePixelRatioVal)
  canvas.height = Math.floor(h * devicePixelRatioVal)
  backgroundCanvas.width = canvas.width
  backgroundCanvas.height = canvas.height

  ctx.setTransform(devicePixelRatioVal, 0, 0, devicePixelRatioVal, 0, 0)
  backgroundCtx.setTransform(devicePixelRatioVal, 0, 0, devicePixelRatioVal, 0, 0)

  const stageWidth = Math.min(STAGE_MAX_WIDTH, Math.max(280, Math.floor(w * STAGE_WIDTH_RATIO)))
  const stageHeight = Math.min(STAGE_MAX_HEIGHT, Math.max(220, Math.floor(h * STAGE_HEIGHT_RATIO)))
  stageRect = {
    x: Math.floor((w - stageWidth) / 2),
    y: Math.floor((h - stageHeight) / 2),
    width: stageWidth,
    height: stageHeight,
  }

  fillBackground()
  buildDirtLayers(canvas.width, canvas.height)
}

function fillBackground() {
  const viewWidth = canvas.width / devicePixelRatioVal
  const viewHeight = canvas.height / devicePixelRatioVal

  backgroundCtx.clearRect(0, 0, backgroundCanvas.width, backgroundCanvas.height)
  backgroundCtx.fillStyle = APP_BG_COLOR
  backgroundCtx.fillRect(0, 0, viewWidth, viewHeight)

  backgroundCtx.fillStyle = '#d6e0ec'
  backgroundCtx.fillRect(stageRect.x, stageRect.y, stageRect.width, stageRect.height)
  backgroundCtx.strokeStyle = 'rgba(24, 56, 95, 0.25)'
  backgroundCtx.lineWidth = 4
  backgroundCtx.strokeRect(stageRect.x, stageRect.y, stageRect.width, stageRect.height)
}

resize()
window.addEventListener('resize', () => {
  devicePixelRatioVal = Math.max(1, window.devicePixelRatio || 1)
  resize()
})

let brushImg: HTMLImageElement | null = null
let brushLoadingStarted = false
function loadBrush(): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      brushImg = img
      resolve()
    }
    img.onerror = () => resolve()
    img.src = brushImgSrc
  })
}

function ensureBrushLoading() {
  if (brushLoadingStarted) return
  brushLoadingStarted = true
  void loadBrush()
}

let isRunning = false
let startTime = 0
let lastSampleTime = 0
let lastPos = { x: 0, y: 0 }
let isPointerDown = false
let cleanedPercent = 0
let hasStarted = false
let pointerVisible = false
let pointerPos = { x: 0, y: 0 }
let pointerType: 'mouse' | 'touch' | null = null
let activeLayerIndex = 0
let gameplayInputAttached = false

function getActiveLayer() {
  return dirtLayers[activeLayerIndex] ?? null
}

function eraseAt(x: number, y: number) {
  const layer = getActiveLayer()
  if (!layer || layer.cleared) return
  if (
    x < stageRect.x || x > stageRect.x + stageRect.width ||
    y < stageRect.y || y > stageRect.y + stageRect.height
  ) {
    return
  }

  layer.ctx.save()
  layer.ctx.globalCompositeOperation = 'destination-out'
  layer.ctx.beginPath()
  layer.ctx.arc(x, y, BRUSH_SIZE * 0.34, 0, Math.PI * 2)
  layer.ctx.fill()
  layer.ctx.restore()
}

function updatePointerPosition(e: PointerEvent) {
  const rect = canvas.getBoundingClientRect()
  pointerPos = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  }
  pointerVisible = true
  pointerType = e.pointerType === 'touch' ? 'touch' : 'mouse'
}

function pointerDown(e: PointerEvent) {
  if (!isRunning) return
  updatePointerPosition(e)
  isPointerDown = true
  lastPos = { ...pointerPos }
  eraseAt(pointerPos.x, pointerPos.y)
}

function pointerMove(e: PointerEvent) {
  if (!isRunning) return
  updatePointerPosition(e)

  if (pointerType === 'mouse' && !isPointerDown) {
    return
  }

  if (isPointerDown) {
    const dx = pointerPos.x - lastPos.x
    const dy = pointerPos.y - lastPos.y
    const dist2 = dx * dx + dy * dy
    if (dist2 > 4) {
      eraseAt(pointerPos.x, pointerPos.y)
      lastPos = { ...pointerPos }
    }
  }
}

function pointerUp() {
  isPointerDown = false
  if (pointerType === 'touch') {
    pointerVisible = false
  }
}

function pointerLeave() {
  if (pointerType === 'mouse') {
    pointerVisible = false
  }
}

function attachGameplayInput() {
  if (gameplayInputAttached) return
  canvas.addEventListener('pointerdown', pointerDown)
  canvas.addEventListener('pointermove', pointerMove)
  window.addEventListener('pointerup', pointerUp)
  canvas.addEventListener('pointerleave', pointerLeave)
  gameplayInputAttached = true
}

function detachGameplayInput() {
  if (!gameplayInputAttached) return
  canvas.removeEventListener('pointerdown', pointerDown)
  canvas.removeEventListener('pointermove', pointerMove)
  window.removeEventListener('pointerup', pointerUp)
  canvas.removeEventListener('pointerleave', pointerLeave)
  gameplayInputAttached = false
}

function setTitleOverlayVisible(visible: boolean) {
  titleOverlay.classList.toggle('hidden', !visible)
  titleOverlay.style.display = visible ? 'flex' : 'none'
}

function requestStart() {
  if (!titleOverlay.classList.contains('hidden')) {
    startGame()
  }
}

function requestStartFromGlobalEvent(event: Event) {
  if (titleOverlay.classList.contains('hidden')) {
    return
  }

  const target = event.target
  if (target instanceof HTMLElement) {
    if (target.closest('#startBtn') || target.closest('#titlePanel')) {
      startGame()
    }
  }
}

function computeLayerPercent(layer: DirtLayer, step = 4) {
  const srcX = Math.max(0, Math.floor(stageRect.x * devicePixelRatioVal))
  const srcY = Math.max(0, Math.floor(stageRect.y * devicePixelRatioVal))
  const srcW = Math.max(1, Math.floor(stageRect.width * devicePixelRatioVal))
  const srcH = Math.max(1, Math.floor(stageRect.height * devicePixelRatioVal))
  const data = layer.ctx.getImageData(srcX, srcY, srcW, srcH).data
  const stepPx = Math.max(1, Math.floor(step * devicePixelRatioVal))
  let total = 0
  let cleared = 0
  for (let y = 0; y < srcH; y += stepPx) {
    for (let x = 0; x < srcW; x += stepPx) {
      const idx = (y * srcW + x) * 4
      total++
      if (data[idx + 3] === 0) cleared++
    }
  }
  return (cleared / total) * 100
}

function updateLayerProgress() {
  if (activeLayerIndex >= dirtLayers.length) {
    cleanedPercent = 100
    layerStatusEl.textContent = `LAYER ${dirtLayers.length}/${dirtLayers.length}`
    return
  }

  const current = getActiveLayer()
  if (!current) {
    cleanedPercent = 100
    layerStatusEl.textContent = `LAYER ${dirtLayers.length}/${dirtLayers.length}`
    return
  }

  current.progress = computeLayerPercent(current, 6)
  if (current.progress >= LAYER_CLEAR_THRESHOLD && activeLayerIndex < dirtLayers.length - 1) {
    current.cleared = true
    activeLayerIndex++
  } else if (activeLayerIndex === dirtLayers.length - 1 && current.progress >= 99) {
    current.cleared = true
    activeLayerIndex = dirtLayers.length
  }

  const completedLayers = dirtLayers.filter((layer) => layer.cleared).length
  cleanedPercent = Math.min(100, ((completedLayers + (current.cleared ? 0 : current.progress / 100)) / dirtLayers.length) * 100)
  layerStatusEl.textContent = activeLayerIndex >= dirtLayers.length
    ? `LAYER ${dirtLayers.length}/${dirtLayers.length}`
    : `LAYER ${activeLayerIndex + 1}/${dirtLayers.length}`
}

function render() {
  const viewWidth = canvas.width / devicePixelRatioVal
  const viewHeight = canvas.height / devicePixelRatioVal

  ctx.clearRect(0, 0, viewWidth, viewHeight)
  ctx.drawImage(backgroundCanvas, 0, 0, viewWidth, viewHeight)

  for (let i = 0; i < dirtLayers.length; i++) {
    const layer = dirtLayers[i]
    if (layer.cleared) continue
    ctx.save()
    ctx.globalAlpha = layer.opacity
    ctx.drawImage(layer.canvas, 0, 0, viewWidth, viewHeight)
    ctx.restore()
  }

  if (isRunning && pointerVisible && brushImg) {
    const cursorWidth = BRUSH_SIZE
    const cursorHeight = (brushImg.height / brushImg.width) * cursorWidth
    ctx.save()
    ctx.globalAlpha = pointerType === 'touch' ? 0.92 : 0.98
    ctx.drawImage(
      brushImg,
      pointerPos.x - cursorWidth / 2,
      pointerPos.y - cursorHeight / 2,
      cursorWidth,
      cursorHeight,
    )
    ctx.restore()
  }
}

function lockInput() {
  isRunning = false
  isPointerDown = false
  detachGameplayInput()
}

function startGame() {
  setTitleOverlayVisible(false)
  ensureBrushLoading()
  hasStarted = true
  isRunning = true
  startTime = performance.now()
  lastSampleTime = 0
  cleanedPercent = 0
  activeLayerIndex = 0
  resultOverlay.classList.add('hidden')
  pointerVisible = false
  layerStatusEl.textContent = `LAYER 1/${dirtLayers.length}`
  fillBackground()
  buildDirtLayers(canvas.width, canvas.height)
  attachGameplayInput()
}

function endGame() {
  try {
    updateLayerProgress()
    scoreEl.textContent = cleanedPercent.toFixed(1)
  } catch {
    // 終了時の最終計算失敗は無視
  }
  lockInput()
  cleanedPercent = Math.max(0, Math.min(100, cleanedPercent))
  finalScoreEl.textContent = cleanedPercent.toFixed(1)
  resultOverlay.classList.remove('hidden')
  timerEl.textContent = '0.00'
}

function resetGameStateToTitle() {
  resultOverlay.classList.add('hidden')
  setTitleOverlayVisible(true)
  hasStarted = false
  pointerVisible = false
  timerEl.textContent = (GAME_TIME_MS / 1000).toFixed(2)
  scoreEl.textContent = '0.0'
  layerStatusEl.textContent = `LAYER 1/${dirtLayers.length}`
  activeLayerIndex = 0
  fillBackground()
  buildDirtLayers(canvas.width, canvas.height)
  render()
}

function buildShareText() {
  const score = cleanedPercent.toFixed(1)
  const url = SHARE_URL
  return `私の掃除率は${score}%。ぬれぞうきん先輩にありがとうといって。${url}`
}

async function handleShareResult() {
  const text = buildShareText()
  const previousLabel = shareBtn?.textContent ?? '共有'

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
    } else {
      const tempInput = document.createElement('textarea')
      tempInput.value = text
      tempInput.setAttribute('readonly', 'true')
      tempInput.style.position = 'fixed'
      tempInput.style.left = '-9999px'
      document.body.appendChild(tempInput)
      tempInput.select()
      document.execCommand('copy')
      document.body.removeChild(tempInput)
    }

    if (shareBtn) {
      shareBtn.textContent = 'コピーしました'
      window.setTimeout(() => {
        if (shareBtn) {
          shareBtn.textContent = previousLabel
        }
      }, 1200)
    }
  } catch {
    window.prompt('共有文をコピーしてください', text)
  }
}

startBtn.addEventListener('click', () => {
  requestStart()
})

startBtn.addEventListener('pointerdown', (event) => {
  event.preventDefault()
  requestStart()
})

titlePanel.addEventListener('pointerup', (event) => {
  if (event.target instanceof HTMLButtonElement) {
    return
  }
  requestStart()
})

titlePanel.addEventListener('click', (event) => {
  if (event.target instanceof HTMLButtonElement) {
    return
  }
  requestStart()
})

titleOverlay.addEventListener('pointerdown', (event) => {
  if (event.target instanceof HTMLButtonElement) {
    return
  }
  requestStart()
})

window.addEventListener('pointerdown', requestStartFromGlobalEvent, true)
retryBtn?.addEventListener('click', () => {
  resetGameStateToTitle()
})
shareBtn?.addEventListener('click', () => {
  void handleShareResult()
})

function loop(now: number) {
  if (isRunning) {
    const elapsed = now - startTime
    const remaining = Math.max(0, GAME_TIME_MS - elapsed)
    timerEl.textContent = (remaining / 1000).toFixed(2)

    if (now - lastSampleTime > SAMPLE_INTERVAL_MS) {
      try {
        updateLayerProgress()
        scoreEl.textContent = cleanedPercent.toFixed(1)
      } catch {
        // getImageData の失敗は無視
      }
      lastSampleTime = now
    }

    render()

    if (now - startTime >= GAME_TIME_MS) {
      endGame()
    }
  } else {
    if (!hasStarted) {
      timerEl.textContent = (GAME_TIME_MS / 1000).toFixed(2)
      scoreEl.textContent = '0.0'
    }
    render()
  }

  requestAnimationFrame(loop)
}

requestAnimationFrame(loop)
