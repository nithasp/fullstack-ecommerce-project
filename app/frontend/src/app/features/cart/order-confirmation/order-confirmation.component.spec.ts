import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { OrderConfirmationComponent } from './order-confirmation.component';

describe('OrderConfirmationComponent', () => {
  let component: OrderConfirmationComponent;
  let fixture: ComponentFixture<OrderConfirmationComponent>;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      declarations: [OrderConfirmationComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(OrderConfirmationComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display confirmation title', () => {
    const title = fixture.nativeElement.querySelector('.confirmation__title');
    expect(title.textContent).toContain('Order Confirmed');
  });

  it('should display confirmation message', () => {
    const message = fixture.nativeElement.querySelector('.confirmation__message');
    expect(message.textContent).toContain('Thank you');
  });

  it('should have continue shopping button', () => {
    const btn = fixture.nativeElement.querySelector('.confirmation__btn');
    expect(btn).toBeTruthy();
    expect(btn.textContent).toContain('Continue Shopping');
  });

  it('should navigate to products on continue shopping', () => {
    spyOn(router, 'navigate');
    component.continueShopping();
    expect(router.navigate).toHaveBeenCalledWith(['/products']);
  });
});
