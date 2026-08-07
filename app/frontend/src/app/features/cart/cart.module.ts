import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { CartRoutingModule } from './cart-routing.module';
import { CartPageComponent } from './cart-page/cart-page.component';
import { OrderConfirmationComponent } from './order-confirmation/order-confirmation.component';
import { AddressDialogComponent } from './components/dialogs/address-dialog/address-dialog.component';
import { PaymentDialogComponent } from './components/dialogs/payment-dialog/payment-dialog.component';
import { OmisePaymentDialogComponent } from './components/dialogs/omise-payment-dialog/omise-payment-dialog.component';

@NgModule({
  declarations: [
    CartPageComponent,
    OrderConfirmationComponent,
    AddressDialogComponent,
    PaymentDialogComponent,
    OmisePaymentDialogComponent
  ],
  imports: [
    SharedModule,
    CartRoutingModule
  ]
})
export class CartModule {}
