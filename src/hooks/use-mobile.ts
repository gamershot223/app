import * as React from 'react';

/** Ниже этой ширины сайдбар и подобные раскладки уходят в мобильный режим. */
export const MOBILE_BREAKPOINT = 768;

/**
 * `undefined` до первого измерения — чтобы на первом рендере не отдать мобильную
 * ветку там, где экран десктопный (и наоборот).
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia('(max-width: ' + (MOBILE_BREAKPOINT - 1) + 'px)');
    const onChange = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isMobile === true;
}
