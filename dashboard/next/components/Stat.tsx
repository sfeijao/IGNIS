export default function Stat({ label, value, dotColor, subtle }: { label: string; value: string; dotColor: string; subtle?: string }) {
  return (
    <div className="card card-gradient p-5 relative">
      {subtle && (
        <span className="absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded-full bg-neutral-800 border border-neutral-700 text-neutral-300">
          {subtle}
        </span>
      )}
      <div className="badge mb-2">
        <span className="dot" style={{ backgroundColor: dotColor }} />
        {label}
      </div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  )
}
