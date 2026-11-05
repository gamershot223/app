import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Корневой ErrorBoundary (W-инсайт №2). Без него ЛЮБОЕ исключение в рендере
 * (упавший fetch в useEffect, undefined в .map, битый пропс) размонтирует всё
 * дерево — посетитель видит белый экран вместо сайта.
 *
 * Хука-эквивалента у React нет и в 18, и в 19: перехват ошибок рендера
 * существует только у классового компонента через `static
 * getDerivedStateFromError` (переключить на фолбэк) + `componentDidCatch`
 * (залогировать). Поэтому этот файл — единственный класс в шаблоне.
 *
 * Агент: не удаляй обёртку в main.tsx. Текст и вёрстку фолбэка менять можно —
 * цвета только через токены (bg-background / text-foreground / bg-primary),
 * как во всём остальном шаблоне.
 */

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  error: Error | null;
};

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Консоль — единственный приёмник: внешней телеметрии у сгенерированного
    // проекта нет, а тихо глотать ошибку нельзя (её ловит превью-раннер).
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div
        role="alert"
        className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background px-6 py-16 text-center text-foreground"
      >
        <h1 className="max-w-xl font-display text-3xl sm:text-4xl">
          Страница не загрузилась
        </h1>
        <p className="max-w-md text-base leading-relaxed text-foreground/70">
          Что-то пошло не так на нашей стороне. Обновите страницу — чаще всего
          этого достаточно. Если не помогло, вернитесь чуть позже.
        </p>
        <button
          type="button"
          onClick={this.handleReload}
          className="rounded-md bg-primary px-6 py-3 text-base font-medium text-background transition hover:opacity-90"
        >
          Обновить
        </button>
      </div>
    );
  }
}
