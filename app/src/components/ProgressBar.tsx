type Props = {
  current: number;
  total?: number;
};

export function ProgressBar({ current, total = 4 }: Props) {
  return (
    <div className="flex gap-1.5 px-5 pt-6 pb-3">
      {Array.from({ length: total }, (_, i) => {
        const filled = i < current;
        return (
          <div
            key={i}
            className={`flex-1 h-[3px] rounded-full ${
              filled ? "bg-accent" : "bg-border"
            }`}
          />
        );
      })}
    </div>
  );
}
