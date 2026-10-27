export function CompletionProgress({
  total,
  reported,
  awaiting,
  verified,
}: {
  total: number;
  reported: number;
  awaiting: number;
  verified: number;
}) {
  const completed = reported + awaiting + verified;
  const percent = total > 0 ? Math.round((completed / total) * 1000) / 10 : 0;
  return (
    <div className="dashboard-progress">
      <div>
        <strong>{percent}% reported</strong>
        <span>
          {completed} of {total} assigned students
        </span>
      </div>
      <progress
        value={completed}
        max={Math.max(total, 1)}
        aria-label={`${completed} of ${total} students reported completion`}
      />
    </div>
  );
}
