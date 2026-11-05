// Готовый компонент проекта (shadcn/ui, MIT), адаптированный под React 19 +
// Tailwind 4 и токены этого шаблона. Не переписывай его с нуля — импортируй.
// Цвета только токенами: см. src/components/ui/README.md.
// react-resizable-panels 4.x (закреплён в package.json/lock) переименовал
// экспорты: PanelGroup → Group, PanelResizeHandle → Separator. Шаблон нёс
// старый shadcn-код под 2.x, поэтому `tsc -b` падал НА ЧИСТОМ шаблоне —
// значит `npm run build` (self-check и публикация) был красным у любого
// проекта ещё до первой строки агента. Имена наружу оставлены прежними
// (Resizable*), их знает и агент, и уже сгенерированный код.
import * as React from 'react';
import * as ResizablePrimitive from 'react-resizable-panels';
import { GripVertical } from 'lucide-react';
import { cn } from '../../lib/utils';

function ResizablePanelGroup({
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.Group>) {
  return (
    <ResizablePrimitive.Group
      data-slot="resizable-panel-group"
      className={cn('flex h-full w-full data-[panel-group-direction=vertical]:flex-col', className)}
      {...props}
    />
  );
}

function ResizablePanel({ ...props }: React.ComponentProps<typeof ResizablePrimitive.Panel>) {
  return <ResizablePrimitive.Panel data-slot="resizable-panel" {...props} />;
}

function ResizableHandle({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.Separator> & { withHandle?: boolean }) {
  return (
    <ResizablePrimitive.Separator
      data-slot="resizable-handle"
      className={cn(
        'relative flex w-px items-center justify-center bg-border focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full',
        className,
      )}
      {...props}
    >
      {withHandle ? (
        <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border border-border bg-card">
          <GripVertical className="size-2.5" aria-hidden="true" />
        </div>
      ) : null}
    </ResizablePrimitive.Separator>
  );
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
