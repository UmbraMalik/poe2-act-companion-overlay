interface SectionListProps {
  title: string;
  items: string[];
  mutedItems?: string[];
}

export function SectionList({
  title,
  items,
  mutedItems = []
}: SectionListProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="panel-section">
      <h2>{title}</h2>
      <ul>
        {items.map((item) => (
          <li key={item} className={mutedItems.includes(item) ? 'muted-list-item' : undefined}>
            <span>{item}</span>
            {mutedItems.includes(item) && (
              <em className="likely-done-badge">похоже, выполнено</em>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
