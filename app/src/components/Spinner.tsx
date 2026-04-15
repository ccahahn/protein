export function Spinner({ label }: { label?: string }) {
  return (
    <div className="text-center my-8">
      <div className="w-7 h-7 rounded-full border-[3px] border-border border-t-accent mx-auto mb-3 spinner" />
      {label && <p className="text-xs text-muted">{label}</p>}
    </div>
  );
}
