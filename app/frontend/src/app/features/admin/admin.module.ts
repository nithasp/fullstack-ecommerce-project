import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { AdminRoutingModule } from './admin-routing.module';
import { ActivityLogComponent } from './activity-log/activity-log.component';
import { HumanizePipe } from './pipes/humanize.pipe';

@NgModule({
  declarations: [
    ActivityLogComponent,
    HumanizePipe
  ],
  imports: [
    SharedModule,
    AdminRoutingModule
  ]
})
export class AdminModule {}
