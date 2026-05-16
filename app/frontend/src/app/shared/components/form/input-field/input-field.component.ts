import { Component, EventEmitter, forwardRef, Input, Output } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-input-field',
  templateUrl: './input-field.component.html',
  styleUrl: './input-field.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputFieldComponent),
      multi: true
    }
  ]
})
export class InputFieldComponent implements ControlValueAccessor {
  @Input() label = '';
  @Input() type = 'text';
  @Input() placeholder = '';
  @Input() name = '';
  @Input() required = false;
  @Input() minLength = 0;
  @Input() maxLength = 0;
  @Input() pattern = '';
  @Input() errorMessages: Record<string, string> = {};
  @Input() forceTouch = false;

  @Output() valueChanged = new EventEmitter<string>();

  value = '';
  touched = false;
  disabled = false;

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: string): void {
    this.value = value ?? '';
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  onInput(value: string): void {
    this.value = value;
    this.onChange(value);
    this.valueChanged.emit(value);
  }

  onBlur(): void {
    this.touched = true;
    this.onTouched();
  }

  get errors(): string[] {
    const errs: string[] = [];
    if (this.required && !this.value?.trim()) {
      errs.push(this.errorMessages['required'] || `${this.label} is required`);
    }
    if (this.minLength > 0 && this.value && this.value.length < this.minLength) {
      errs.push(
        this.errorMessages['minLength'] ||
        `${this.label} must be at least ${this.minLength} characters`
      );
    }
    if (this.maxLength > 0 && this.value && this.value.length > this.maxLength) {
      errs.push(
        this.errorMessages['maxLength'] ||
        `${this.label} must be at most ${this.maxLength} characters`
      );
    }
    if (this.pattern && this.value) {
      if (!new RegExp(this.pattern).test(this.value)) {
        errs.push(this.errorMessages['pattern'] || `${this.label} format is invalid`);
      }
    }
    if (this.type === 'email' && this.value) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.value)) {
        errs.push(this.errorMessages['email'] || 'Please enter a valid email');
      }
    }
    return errs;
  }

  get showErrors(): boolean {
    return (this.touched || this.forceTouch) && this.errors.length > 0;
  }

  get isValid(): boolean {
    return this.errors.length === 0 && !!this.value?.trim();
  }
}
