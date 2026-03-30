/**
 * Content script: injects estimated earnings-per-minute (EPM) into each Upromise survey tile.
 * EPM = survey payout ÷ estimated minutes.
 */

const EPM_WRAPPER_CLASS = 'upromise-survey-epm-extension'
const EPM_LABEL_CLASS = 'upromise-survey-epm-extension__label'

const isInsideEpmUi = (node: Node | null): boolean => {
  const root =
    node instanceof Element ? node : node?.parentElement ?? null
  return Boolean(root?.closest(`.${EPM_WRAPPER_CLASS}`))
}

type ParsedMoney = Readonly<{
  amount: number
  raw: string
}>

const parseMinutesFromText = (text: string): number | null => {
  const trimmed = text.trim()
  const match = trimmed.match(/(\d+(?:\.\d+)?)\s*min/i)
  if (!match) {
    return null
  }
  const value = Number.parseFloat(match[1])
  if (!Number.isFinite(value) || value <= 0) {
    return null
  }
  return value
}

const parseDollarAmount = (text: string): ParsedMoney | null => {
  const normalized = text.replace(/,/g, '').trim()
  const match = normalized.match(/\$\s*([\d.]+)/)
  if (!match) {
    return null
  }
  const amount = Number.parseFloat(match[1])
  if (!Number.isFinite(amount) || amount < 0) {
    return null
  }
  return { amount, raw: match[0].trim() }
}

const formatEpm = (dollarsPerMinute: number): string =>
  `$${dollarsPerMinute.toFixed(3)}/min`

const findTimeSpan = (tile: HTMLElement): HTMLSpanElement | null => {
  const byPartial = tile.querySelector<HTMLSpanElement>(
    'span[class*="surveyTime"]'
  )
  if (byPartial) {
    return byPartial
  }
  const spans = tile.querySelectorAll<HTMLSpanElement>('span')
  for (const span of spans) {
    if (isInsideEpmUi(span)) {
      continue
    }
    if (/min/i.test(span.textContent ?? '')) {
      return span
    }
  }
  return null
}

const findEarningsSpan = (tile: HTMLElement): HTMLSpanElement | null => {
  const byPartial = tile.querySelector<HTMLSpanElement>(
    'span[class*="surveyEarnings"]'
  )
  if (byPartial) {
    return byPartial
  }
  const spans = tile.querySelectorAll<HTMLSpanElement>('span')
  for (const span of spans) {
    if (isInsideEpmUi(span)) {
      continue
    }
    if (/\$\s*[\d.]/.test(span.textContent ?? '')) {
      return span
    }
  }
  return null
}

const ensureEpmBlock = (tile: HTMLElement): HTMLElement => {
  const existing = tile.querySelector<HTMLElement>(`.${EPM_WRAPPER_CLASS}`)
  if (existing) {
    return existing
  }
  const wrapper = document.createElement('p')
  wrapper.className = EPM_WRAPPER_CLASS
  wrapper.setAttribute('role', 'status')
  wrapper.setAttribute('aria-live', 'polite')
  wrapper.setAttribute(
    'aria-label',
    'Estimated earnings per minute for this survey'
  )

  const label = document.createElement('span')
  label.className = EPM_LABEL_CLASS
  wrapper.appendChild(label)

  const infoRow = tile.querySelector('p[class*="infoWrapper"]')
  if (infoRow?.parentElement) {
    infoRow.insertAdjacentElement('afterend', wrapper)
  } else {
    const linkRow = tile.querySelector('p[class*="linkWrapper"]')
    if (linkRow) {
      linkRow.insertAdjacentElement('beforebegin', wrapper)
    } else {
      tile.appendChild(wrapper)
    }
  }

  return wrapper
}

const applyEpmStyles = (wrapper: HTMLElement): void => {
  if (wrapper.dataset.epmStyled === '1') {
    return
  }
  wrapper.dataset.epmStyled = '1'
  Object.assign(wrapper.style, {
    margin: '0.35rem 0 0',
    fontSize: '1.05rem',
    fontWeight: '600',
    color: '#0f5132',
    lineHeight: '1.35',
    textAlign: 'center'
  } as CSSStyleDeclaration)

  const label = wrapper.querySelector<HTMLElement>(`.${EPM_LABEL_CLASS}`)
  if (label) {
    Object.assign(label.style, {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0.3rem 0.6rem',
      borderRadius: '4px',
      backgroundColor: 'rgba(25, 135, 84, 0.12)',
      border: '1px solid rgba(25, 135, 84, 0.35)'
    } as CSSStyleDeclaration)
  }
}

const updateTile = (tile: HTMLElement): void => {
  if (!tile.classList.contains('surveysTile')) {
    return
  }

  const timeEl = findTimeSpan(tile)
  const earnEl = findEarningsSpan(tile)
  const minutes = timeEl
    ? parseMinutesFromText(timeEl.textContent ?? '')
    : null
  const money = earnEl ? parseDollarAmount(earnEl.textContent ?? '') : null

  const wrapper = ensureEpmBlock(tile)
  applyEpmStyles(wrapper)
  const label = wrapper.querySelector<HTMLElement>(`.${EPM_LABEL_CLASS}`)
  if (!label) {
    return
  }

  if (minutes === null || money === null) {
    const nextText = 'EPM: — (could not read time or earnings)'
    if (label.textContent !== nextText) {
      label.textContent = nextText
    }
    label.style.color = '#6c757d'
    return
  }

  const epm = money.amount / minutes
  const nextText = `Est. EPM: ${formatEpm(epm)} (${money.raw} ÷ ${minutes} min)`
  if (label.textContent !== nextText) {
    label.textContent = nextText
  }
  label.style.color = '#0f5132'
}

const scanDocument = (): void => {
  const tiles = document.querySelectorAll<HTMLElement>('li.surveysTile')
  tiles.forEach((tile) => updateTile(tile))
}

let observer: MutationObserver | null = null
let debounceTimerId: ReturnType<typeof setTimeout> | null = null
let scanFrameId: number | null = null

const SCAN_DEBOUNCE_MS = 250

const mutationsLookIgnorable = (records: MutationRecord[]): boolean => {
  for (const record of records) {
    if (!isInsideEpmUi(record.target)) {
      return false
    }
    for (const node of record.addedNodes) {
      if (!isInsideEpmUi(node)) {
        return false
      }
    }
    for (const node of record.removedNodes) {
      if (!isInsideEpmUi(node)) {
        return false
      }
    }
  }
  return records.length > 0
}

const runScanWithObserverPaused = (): void => {
  observer?.disconnect()
  scanDocument()
  observer?.observe(document.documentElement, {
    childList: true,
    subtree: true
  })
}

const scheduleScanFromMutations = (records: MutationRecord[]): void => {
  if (mutationsLookIgnorable(records)) {
    return
  }
  if (debounceTimerId !== null) {
    clearTimeout(debounceTimerId)
  }
  debounceTimerId = window.setTimeout(() => {
    debounceTimerId = null
    if (scanFrameId !== null) {
      cancelAnimationFrame(scanFrameId)
    }
    scanFrameId = window.requestAnimationFrame(() => {
      scanFrameId = null
      runScanWithObserverPaused()
    })
  }, SCAN_DEBOUNCE_MS)
}

const initObserver = (): void => {
  if (observer) {
    return
  }
  observer = new MutationObserver((records) => {
    scheduleScanFromMutations(records)
  })
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  })
}

const bootstrap = (): void => {
  runScanWithObserverPaused()
  initObserver()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap, { once: true })
} else {
  bootstrap()
}
