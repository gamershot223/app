// Готовый компонент проекта (shadcn/ui, MIT), адаптированный под React 19 +
// Tailwind 4 и токены этого шаблона. Не переписывай его с нуля — импортируй.
// Цвета только токенами: см. src/components/ui/README.md.
import * as React from 'react';
import { cn } from '../../lib/utils';

/**
 * Прогресс без @radix-ui/react-progress: примитива нет в зависимостях шаблона,
 * а роль/aria здесь укладываются в несколько атрибутов.
 */
export interface ProgressProps extends React.ComponentProps<'div'> {
  value?: number;
  max?: number;
}

function Progress({ className, value = 0, max = 100, ...props }: ProgressProps) {
  const clamped = Math.min(Math.max(value, 0), max);
  const percent = max > 0 ? (clamped / max) * 100 : 0;
  return (
    <div
      data-slot="progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={clamped}
      className={cn('relative h-2 w-full overflow-hidden rounded-full bg-muted', className)}
      {...props}
    >
      <div
        data-slot="progress-indicator"
        className="h-full bg-primary transition-transform"
        style={{ width: percent + '%' }}
      />
    </div>
  );
}

export { Progress };
