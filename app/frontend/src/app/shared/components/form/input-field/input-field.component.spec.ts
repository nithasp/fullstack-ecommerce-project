import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { InputFieldComponent } from './input-field.component';

describe('InputFieldComponent', () => {
  let component: InputFieldComponent;
  let fixture: ComponentFixture<InputFieldComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormsModule],
      declarations: [InputFieldComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(InputFieldComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with empty value', () => {
    expect(component.value).toBe('');
    expect(component.touched).toBeFalse();
    expect(component.disabled).toBeFalse();
  });

  it('should update value on input', () => {
    component.onInput('Hello');
    expect(component.value).toBe('Hello');
  });

  it('should emit valueChanged on input', () => {
    spyOn(component.valueChanged, 'emit');
    component.onInput('Test');
    expect(component.valueChanged.emit).toHaveBeenCalledWith('Test');
  });

  it('should set touched on blur', () => {
    expect(component.touched).toBeFalse();
    component.onBlur();
    expect(component.touched).toBeTrue();
  });

  it('should show required error when field is required and empty', () => {
    component.required = true;
    component.label = 'Name';
    component.value = '';
    component.touched = true;
    expect(component.errors.length).toBeGreaterThan(0);
    expect(component.errors[0]).toContain('required');
    expect(component.showErrors).toBeTrue();
  });

  it('should show minLength error when value is too short', () => {
    component.minLength = 5;
    component.label = 'Name';
    component.value = 'Hi';
    component.touched = true;
    expect(component.errors.length).toBeGreaterThan(0);
    expect(component.errors[0]).toContain('at least 5 characters');
  });

  it('should show maxLength error when value is too long', () => {
    component.maxLength = 3;
    component.label = 'Code';
    component.value = 'ABCDEF';
    component.touched = true;
    expect(component.errors.length).toBeGreaterThan(0);
    expect(component.errors[0]).toContain('at most 3 characters');
  });

  it('should show pattern error when value does not match pattern', () => {
    component.pattern = '^\\d+$';
    component.label = 'Number';
    component.value = 'abc';
    component.touched = true;
    expect(component.errors.length).toBeGreaterThan(0);
    expect(component.errors[0]).toContain('format is invalid');
  });

  it('should show email error for invalid email', () => {
    component.type = 'email';
    component.label = 'Email';
    component.value = 'notanemail';
    component.touched = true;
    expect(component.errors.length).toBeGreaterThan(0);
    expect(component.errors[0]).toContain('valid email');
  });

  it('should pass validation for valid email', () => {
    component.type = 'email';
    component.label = 'Email';
    component.value = 'test@example.com';
    component.touched = true;
    expect(component.errors.length).toBe(0);
  });

  it('should not show errors when not touched', () => {
    component.required = true;
    component.value = '';
    expect(component.showErrors).toBeFalse();
  });

  it('should use custom error messages when provided', () => {
    component.required = true;
    component.label = 'Field';
    component.errorMessages = { required: 'Please fill this in' };
    component.value = '';
    expect(component.errors[0]).toBe('Please fill this in');
  });

  it('should support writeValue from ControlValueAccessor', () => {
    component.writeValue('initial');
    expect(component.value).toBe('initial');
  });

  it('should handle null in writeValue', () => {
    component.writeValue(null as unknown as string);
    expect(component.value).toBe('');
  });

  it('should support setDisabledState', () => {
    component.setDisabledState(true);
    expect(component.disabled).toBeTrue();
    component.setDisabledState(false);
    expect(component.disabled).toBeFalse();
  });

  it('should render label in template', () => {
    component.label = 'Test Label';
    component.name = 'test';
    fixture.detectChanges();
    const label = fixture.nativeElement.querySelector('.input-field__label');
    expect(label.textContent).toContain('Test Label');
  });

  it('should render error message in template when invalid', () => {
    component.required = true;
    component.label = 'Name';
    component.name = 'name';
    component.value = '';
    component.touched = true;
    fixture.detectChanges();
    const error = fixture.nativeElement.querySelector('.input-field__error-msg');
    expect(error).toBeTruthy();
    expect(error.textContent).toContain('required');
  });

});
