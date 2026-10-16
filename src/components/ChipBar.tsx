import { useRef, useState } from 'react';
import { IconChevronLeft, IconChevronRight } from './icons';

interface Props {
  items: string[];
  value: string;
  onChange: (v: string) => void;
}

/** Barre de catégories façon YouTube : chips défilables avec flèches. */
export function ChipBar({ items, value, onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const update = () => {
    const el = ref.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  };

  const scrollBy = (dir: 1 | -1) => {
    ref.current?.scrollBy({ left: dir * 320, behavior: 'smooth' });
  };

  return (
    <div className="chips">
      {!atStart && (
        <button className="chips__arrow chips__arrow--left" aria-label="Voir moins" onClick={() => scrollBy(-1)}>
          <IconChevronLeft width={20} height={20} />
        </button>
      )}
      <div className="chips__track" ref={ref} onScroll={update}>
        {items.map((item) => (
          <button
            key={item}
            className={`chip${value === item ? ' chip--active' : ''}`}
            onClick={() => onChange(item)}
          >
            {item}
          </button>
        ))}
      </div>
      {!atEnd && (
        <button className="chips__arrow chips__arrow--right" aria-label="Voir plus" onClick={() => scrollBy(1)}>
          <IconChevronRight width={20} height={20} />
        </button>
      )}
    </div>
  );
}
