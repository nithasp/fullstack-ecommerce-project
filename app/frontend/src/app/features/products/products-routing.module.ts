import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ProductListComponent } from './product-list/product-list.component';
import { ProductDetailComponent } from './product-detail/product-detail.component';

// data.page names each page in the admin Activity Log
const routes: Routes = [
  { path: '', component: ProductListComponent, data: { page: 'Products' } },
  { path: ':id', component: ProductDetailComponent, data: { page: 'Product detail' } }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ProductsRoutingModule { }
