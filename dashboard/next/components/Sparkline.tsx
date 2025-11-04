"use client"

import React from 'react'

export default function Sparkline({ data, width = 400, height = 40, className }: { data: number[]; width?: number; height?: number; className?: string }) {
  const d = data && data.length ? data : [0]
  const min = Math.min(...d)
  const max = Math.max(...d)
  const range = Math.max(1, max - min)
  const points = d.map((v, i) => {
    const x = (i / Math.max(1, d.length - 1)) * width
    const y = height - ((v - min) / range) * height
    return `${x},${y}`
  }).join(' ')
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} className={className} aria-hidden>
      <polyline fill="none" stroke="url(#g)" strokeWidth="2" points={points} />
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#7C3AED" />
          <stop offset="100%" stopColor="#60A5FA" />
        </linearGradient>
      </defs>
    </svg>
  )
}
