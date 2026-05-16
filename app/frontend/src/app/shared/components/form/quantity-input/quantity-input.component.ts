import { Component, forwardRef, Input, OnDestroy } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-quantity-input',
  templateUrl: './quantity-input.component.html',
  styleUrl: './quantity-input.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => QuantityInputComponent),
      multi: true
    }
  ]
})
export class QuantityInputComponent implements ControlValueAccessor, OnDestroy {
  @Input() min = 1;
  @Input() max = 99;

  value = 1;
  disabled = false;

  private isTyping = false;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  private onChange: (value: number) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: number): void {
    // Skip external updates while the user is actively typing so the
    // optimistic cart update doesn't reset the input mid-keystroke.
    if (!this.isTyping) {
      this.value = value ?? this.min;
    }
  }

  registerOnChange(fn: (value: number) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  decrease(): void {
    if (this.disabled || this.value <= this.min) return;
    this.setValue(this.value - 1);
  }

  increase(): void {
    if (this.disabled || this.value >= this.max) return;
    this.setValue(this.value + 1);
  }

  onKeyDown(event: KeyboardEvent): void {
    if (['e', 'E', '-', '+'].includes(event.key)) {
      event.preventDefault();
    }
  }

  onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const parsed = parseInt(input.value, 10);
    if (!isNaN(parsed)) {
      const clamped = this.clamp(parsed);
      this.value = clamped;

      // Immediately correct the displayed value when it exceeds the allowed range
      if (parsed !== clamped) {
        input.value = String(clamped);
      }

      this.isTyping = true;

      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        this.isTyping = false;
        this.debounceTimer = null;
        this.onChange(clamped);
      }, 700);
    }
  }

  onBlur(event: Event): void {
    // Flush any pending debounce immediately on blur
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.isTyping = false;

    const raw = (event.target as HTMLInputElement).value;
    const parsed = parseInt(raw, 10);
    if (isNaN(parsed) || parsed < this.min) {
      this.setValue(this.min);
      (event.target as HTMLInputElement).value = String(this.value);
    } else {
      this.setValue(this.clamp(parsed));
    }
    this.onTouched();
  }

  ngOnDestroy(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  private setValue(val: number): void {
    this.value = val;
    this.onChange(val);
  }

  private clamp(val: number): number {
    return Math.max(this.min, Math.min(this.max, val));
  }

  get isAtMin(): boolean {
    return this.value <= this.min;
  }

  get isAtMax(): boolean {
    return this.value >= this.max;
  }
}

