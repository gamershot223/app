// Готовый компонент проекта (shadcn/ui, MIT), адаптированный под React 19 +
// Tailwind 4 и токены этого шаблона. Не переписывай его с нуля — импортируй.
// Цвета только токенами: см. src/components/ui/README.md.
import { Toaster as Sonner, toast, type ToasterProps } from 'sonner';

/**
 * Тосты проекта. Смонтируй <Toaster /> один раз рядом с корнем приложения,
 * затем вызывай toast('Заявка отправлена') из любого места.
 */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      data-slot="sonner"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group flex w-full items-center gap-3 rounded-lg border border-border bg-popover p-4 text-sm text-popover-foreground shadow-lg',
          description: 'text-muted-foreground',
          actionButton: 'rounded-control bg-primary px-3 py-1 text-xs text-primary-foreground',
          cancelButton: 'rounded-control bg-muted px-3 py-1 text-xs text-foreground',
          error: 'text-destructive',
        },
      }}
      {...props}
    />
  );
}

export { Toaster, toast };
