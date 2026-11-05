// Готовый компонент проекта (shadcn/ui, MIT), адаптированный под React 19 +
// Tailwind 4 и токены этого шаблона. Не переписывай его с нуля — импортируй.
// Цвета только токенами: см. src/components/ui/README.md.
//
// Каркас сайдбара: провайдер и состояние — в `./sidebar-context`, пункты меню —
// в `./sidebar-menu`. Импортировать всё можно отсюда: файл их реэкспортирует.
//
// Отличие от upstream: своей палитры `--sidebar-*` у шаблона нет и заводить её
// некуда, поэтому поверхность сайдбара — тот же `bg-card`, активный пункт —
// `bg-muted`, рамки — `border-border`. Цвета только токенами.
//
// Разметку части помечает `data-slot="sidebar-*"` — прежний `data-sidebar`
// заменён на него вместе с переходом на примитивы нового поколения, чтобы
// селекторы во всей библиотеке были одинаковыми.
import * as React from 'react';
import { PanelLeft } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './button';
import { Input } from './input';
import { Separator } from './separator';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from './sheet';
import { SIDEBAR_WIDTH_MOBILE, useSidebar } from './sidebar-context';

function Sidebar({
  side = 'left',
  variant = 'sidebar',
  collapsible = 'offcanvas',
  className,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  side?: 'left' | 'right';
  variant?: 'sidebar' | 'floating' | 'inset';
  collapsible?: 'offcanvas' | 'icon' | 'none';
}) {
  const { isMobile, state, openMobile, setOpenMobile } = useSidebar();

  if (collapsible === 'none') {
    return (
      <div
        data-slot="sidebar"
        className={cn(
          'flex h-full w-[var(--sidebar-width)] flex-col bg-card text-foreground',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  }

  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile}>
        <SheetContent
          data-slot="sidebar"
          data-mobile="true"
          side={side}
          className="w-[var(--sidebar-width)] p-0 sm:max-w-none"
          style={{ '--sidebar-width': SIDEBAR_WIDTH_MOBILE } as React.CSSProperties}
        >
          <SheetTitle className="sr-only">Навигация</SheetTitle>
          <SheetDescription className="sr-only">Боковое меню разделов</SheetDescription>
          <div className={cn('flex h-full w-full flex-col', className)} {...props}>
            {children}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  const collapsed = state === 'collapsed';
  const iconMode = collapsible === 'icon';
  const inner = variant === 'floating' || variant === 'inset';

  return (
    <div
      data-slot="sidebar"
      className="group peer hidden md:block text-foreground"
      data-state={state}
      data-collapsible={collapsed ? collapsible : ''}
      data-variant={variant}
      data-side={side}
    >
      {/* Распорка: держит ширину в потоке, пока сам сайдбар зафиксирован. */}
      <div
        data-slot="sidebar-gap"
        className={cn(
          'relative h-svh bg-transparent transition-[width] duration-200 ease-linear',
          collapsed
            ? iconMode
              ? 'w-[var(--sidebar-width-icon)]'
              : 'w-0'
            : 'w-[var(--sidebar-width)]',
        )}
      />
      <div
        data-slot="sidebar-container"
        className={cn(
          'fixed inset-y-0 z-10 hidden h-svh transition-[left,right,width] duration-200 ease-linear md:flex',
          side === 'left' ? 'left-0' : 'right-0',
          collapsed
            ? iconMode
              ? 'w-[var(--sidebar-width-icon)]'
              : 'w-0 overflow-hidden'
            : 'w-[var(--sidebar-width)]',
          className,
        )}
        {...props}
      >
        <div
          data-slot="sidebar-inner"
          className={cn(
            'flex h-full w-full flex-col bg-card',
            inner ? 'm-2 h-[calc(100svh-1rem)] rounded-lg border border-border shadow-sm' : '',
            !inner && side === 'left' ? 'border-r border-border' : '',
            !inner && side === 'right' ? 'border-l border-border' : '',
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function SidebarTrigger({ className, onClick, ...props }: React.ComponentProps<typeof Button>) {
  const { toggleSidebar } = useSidebar();
  return (
    <Button
      data-slot="sidebar-trigger"
      variant="ghost"
      size="icon"
      className={cn('size-7', className)}
      onClick={(event) => {
        onClick?.(event);
        toggleSidebar();
      }}
      {...props}
    >
      <PanelLeft />
      <span className="sr-only">Свернуть или развернуть меню</span>
    </Button>
  );
}

/** Узкая полоса по краю сайдбара: тянуть мышью нечего, но клик сворачивает. */
function SidebarRail({ className, ...props }: React.ComponentProps<'button'>) {
  const { toggleSidebar } = useSidebar();
  return (
    <button
      data-slot="sidebar-rail"
      type="button"
      aria-label="Свернуть или развернуть меню"
      tabIndex={-1}
      onClick={toggleSidebar}
      className={cn(
        'absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-colors hover:bg-border md:flex',
        'group-data-[side=left]:right-0 group-data-[side=right]:left-0',
        className,
      )}
      {...props}
    />
  );
}

function SidebarInset({ className, ...props }: React.ComponentProps<'main'>) {
  return (
    <main
      data-slot="sidebar-inset"
      className={cn(
        'relative flex min-h-svh flex-1 flex-col bg-background',
        'peer-data-[variant=inset]:m-2 peer-data-[variant=inset]:rounded-lg peer-data-[variant=inset]:border peer-data-[variant=inset]:border-border',
        className,
      )}
      {...props}
    />
  );
}

function SidebarInput({ className, ...props }: React.ComponentProps<typeof Input>) {
  return <Input data-slot="sidebar-input" className={cn('h-8 w-full', className)} {...props} />;
}

function SidebarHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-header"
      className={cn('flex flex-col gap-2 p-2', className)}
      {...props}
    />
  );
}

function SidebarFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-footer"
      className={cn('mt-auto flex flex-col gap-2 p-2', className)}
      {...props}
    />
  );
}

function SidebarContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-content"
      className={cn(
        'flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden',
        className,
      )}
      {...props}
    />
  );
}

function SidebarSeparator({ className, ...props }: React.ComponentProps<typeof Separator>) {
  return (
    <Separator data-slot="sidebar-separator" className={cn('mx-2 w-auto', className)} {...props} />
  );
}

export {
  Sidebar,
  SidebarTrigger,
  SidebarRail,
  SidebarInset,
  SidebarInput,
  SidebarHeader,
  SidebarFooter,
  SidebarContent,
  SidebarSeparator,
};
export {
  SidebarProvider,
  useSidebar,
  SIDEBAR_WIDTH,
  SIDEBAR_WIDTH_ICON,
  SIDEBAR_WIDTH_MOBILE,
} from './sidebar-context';
export {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from './sidebar-menu';
