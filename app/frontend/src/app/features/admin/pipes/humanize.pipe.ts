import { Pipe, PipeTransform } from '@angular/core';

// Makes a code readable: 'cart.item_added' → 'Cart item added', 'LOGIN_FAILED' → 'LOGIN FAILED'
@Pipe({
  name: 'humanize'
})
export class HumanizePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '';
    const words = value.replace(/[._]+/g, ' ').trim();
    return words.charAt(0).toUpperCase() + words.slice(1);
  }
}
