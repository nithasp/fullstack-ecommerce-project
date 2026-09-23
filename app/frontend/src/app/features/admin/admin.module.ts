import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { AdminRoutingModule } from './admin-routing.module';
import { ActivityLogComponent } from './activity-log/activity-log.component';
import { PageViewsComponent } from './page-views/page-views.component';
import { HumanizePipe } from './pipes/humanize.pipe';

@NgModule({
  declarations: [
    ActivityLogComponent,
    PageViewsComponent,
    HumanizePipe
  ],
  imports: [
    SharedModule,
    AdminRoutingModule
  ]
})
export class AdminModule {}
