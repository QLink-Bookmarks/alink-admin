export function Badge({ active }: { active: boolean }) {
  return (
    <span className="badge" data-active={active}>
      {active ? '활성' : '비활성'}
    </span>
  );
}
