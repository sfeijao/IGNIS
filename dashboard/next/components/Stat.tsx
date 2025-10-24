export default function Stat({ label, value, dotColor }: { label: string; value: string; dotColor: string }) {
  return (
    <div className="card card-gradient p-5">
      <div className="badge mb-2">
        <span className="dot" style={{ backgroundColor: dotColor }} />
        {label}
      </div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  )
}
