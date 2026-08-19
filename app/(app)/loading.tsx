export default function Loading() {
  return (
    <div className="grid animate-pulse gap-4">
      <div className="h-24 rounded-[28px] bg-white/50" />
      <div className="grid grid-cols-3 gap-3">
        <div className="h-40 rounded-[28px] bg-white/50" />
        <div className="h-40 rounded-[28px] bg-white/50" />
        <div className="h-40 rounded-[28px] bg-white/50" />
      </div>
      <div className="h-56 rounded-[28px] bg-white/50" />
    </div>
  );
}
