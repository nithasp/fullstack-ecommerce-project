import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ActivityLogComponent } from './activity-log/activity-log.component';
import { PageViewsComponent } from './page-views/page-views.component';

// data.page names each page in the admin Activity Log
const routes: Routes = [
  { path: '', redirectTo: 'activity', pathMatch: 'full' },
  { path: 'activity', component: ActivityLogComponent, data: { page: 'Activity log' } },
  { path: 'page-views', component: PageViewsComponent, data: { page: 'Page views' } }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminRoutingModule {}
