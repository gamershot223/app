import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Склейка классов Tailwind с разрешением конфликтов.
 * Используй её везде, где компонент принимает className извне.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
