/**
 * useOrderAlert — shared hook for looping order-alert sound
 *
 * Design goals:
 * - Single Audio instance per hook call (no duplicates)
 * - Plays /sounds/incoming-order.mp3 in a loop
 * - Falls back to a short Web Audio API beep if the file is missing / autoplay blocked
 * - start() is idempotent (safe to call multiple times)
 * - stop() cleans up fully (pause + reset src)
 * - Automatically cleaned up on component unmount
 *
 * Fixes:
 * - playingRef is only set to true AFTER play() succeeds (not eagerly)
 * - beep() uses a shared AudioContext that's unlocked on first user gesture
 * - Shared AudioContext singleton ensures context stays "running" across calls
 */
'use client'
import { useRef, useCallback, useEffect } from 'react'

// ── Shared AudioContext (one per page lifecycle) ──────────────────────
// Created inside a user gesture so it starts in "running" state.
// Once running, it stays running — no autoplay restriction on later calls.
let sharedCtx: AudioContext | null = null

function getOrCreateCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!sharedCtx) {
    try {
      sharedCtx = new AudioContext()
    } catch {
      return null
    }
  }
  return sharedCtx
}

// Resume the context if it's suspended (shouldn't happen after first user gesture,
// but guard anyway).
async function ensureCtxRunning(ctx: AudioContext): Promise<void> {
  if (ctx.state === 'suspended') {
    try { await ctx.resume() } catch { /* ignore */ }
  }
}

// ── Hook ─────────────────────────────────────────────────────────────
export function useOrderAlert() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const playingRef = useRef(false)

  // Lazily create the Audio element once
  function getAudio(): HTMLAudioElement | null {
    if (typeof window === 'undefined') return null
    if (!audioRef.current) {
      const a = new Audio('/sounds/incoming-order.mp3')
      a.loop = true
      a.volume = 0.85
      // If file fails to load, fall back silently (beep will handle it)
      a.onerror = () => {
        audioRef.current = null
      }
      audioRef.current = a
    }
    return audioRef.current
  }

  // Web Audio API beep — 880 Hz, 300 ms
  async function beep() {
    const ctx = getOrCreateCtx()
    if (!ctx) return
    try {
      await ensureCtxRunning(ctx)
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.4, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
      osc.start()
      osc.stop(ctx.currentTime + 0.35)
    } catch { /* ignore in restricted contexts */ }
  }

  const start = useCallback(() => {
    if (playingRef.current) return   // already playing — idempotent
    const audio = getAudio()

    if (audio) {
      audio.currentTime = 0
      audio.play().then(() => {
        // Only mark as playing AFTER the browser actually starts playback.
        // This prevents playingRef from being stuck at true when autoplay is blocked.
        playingRef.current = true
      }).catch(() => {
        // Autoplay blocked (or file error) — play Web Audio beep instead.
        // Do NOT set playingRef.current = true, so the next incoming order
        // will attempt playback again (and possibly succeed if the user has
        // interacted with the page by then).
        beep()
      })
    } else {
      // Audio element could not be created (SSR or repeated file error)
      beep()
    }
  }, [])

  const stop = useCallback(() => {
    playingRef.current = false
    const audio = audioRef.current
    if (!audio) return
    audio.pause()
    audio.currentTime = 0
  }, [])

  // Unlock audio on first user gesture + cleanup on unmount
  useEffect(() => {
    function onUserGesture() {
      // 1. Create + resume the shared AudioContext during the gesture window
      const ctx = getOrCreateCtx()
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {})
      }
      // 2. Pre-create the Audio element and do a silent play-then-pause
      //    to get past the HTMLAudioElement autoplay gate.
      const a = getAudio()
      if (a) {
        a.play().then(() => {
          a.pause()
          a.currentTime = 0
        }).catch(() => {
          // Still blocked — beep() will handle it later
        })
      }
    }

    document.addEventListener('pointerdown', onUserGesture, { once: true })
    document.addEventListener('keydown', onUserGesture, { once: true })

    return () => {
      document.removeEventListener('pointerdown', onUserGesture)
      document.removeEventListener('keydown', onUserGesture)
      stop()
    }
  }, [stop])

  return { start, stop }
}
