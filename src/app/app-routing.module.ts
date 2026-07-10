import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { InfopanelComponent } from './components/infopanel/infopanel.component';

const routes: Routes = [
  {path: 'info/:id', component: InfopanelComponent}
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {
}
