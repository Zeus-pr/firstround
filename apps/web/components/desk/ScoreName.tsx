export function ScoreName({ className = '' }: { className?: string }) {
  return (
    <span className={`score-name${className ? ` ${className}` : ''}`}>
      <img src="/brand/firstround-logo-ink.svg" alt="firstround" className="score-name-logo" />
      <span>score</span>
    </span>
  );
}
