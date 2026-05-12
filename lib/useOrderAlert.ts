/**
 * useOrderAlert — shared hook for looping order-alert sound
 *
 * Design goals:
 * - Single Audio instance per hook call (no duplicates)
 * - Plays /sounds/incoming-order.mp3 in a loop
 * - Falls back to a short Web Audio API beep if the file is missing
 * - start() is idempotent (safe to call multiple times)
 * - stop() cleans up fully (pause + reset src)
 * - Automatically cleaned up on component unmount
 */
'use client'
import { useRef, useCallback, useEffect } from 'react'

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

  // Web Audio API fallback beep (440 Hz, 200 ms)
  function beep() {
    try {
      const ctx = new AudioContext()
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
    } catch { /* ignore in SSR or restricted contexts */ }
  }

  const start = useCallback(() => {
    if (playingRef.current) return   // already playing — idempotent
    const audio = getAudio()
    if (audio) {
      audio.currentTime = 0
      audio.play().catch(() => {
        // Autoplay blocked — play single beep as fallback
        beep()
      })
      playingRef.current = true
    } else {
      // Audio element could not be created (SSR or file error) — beep loop fallback
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop()
    }
  }, [stop])

  return { start, stop }
}
