"use client"

type Flag = 'stable' | 'rollout' | 'beta'

export default function FeatureBadge({ flag }: { flag?: Flag }) {
  if (!flag || flag === 'stable') return null
  const text = flag === 'rollout' ? 'Em rollout' : 'Beta'
  const color = flag === 'rollout' ? 'bg-amber-600/20 text-amber-300 border-amber-700/60' : 'bg-fuchsia-600/20 text-fuchsia-300 border-fuchsia-700/60'
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${color}`}>{text}</span>
  )
}
