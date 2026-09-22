import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CartPageComponent } from './cart-page/cart-page.component';
import { OrderConfirmationComponent } from './order-confirmation/order-confirmation.component';

// data.page names each page in the admin Activity Log
const routes: Routes = [
  { path: '', component: CartPageComponent, data: { page: 'Cart' } },
  { path: 'confirmation', component: OrderConfirmationComponent, data: { page: 'Order confirmation' } }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CartRoutingModule {}
