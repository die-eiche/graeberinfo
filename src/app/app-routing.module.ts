import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ExcelTableComponent } from './components/excel-table/excel-table.component';
import { InfopanelComponent } from './components/infopanel/infopanel.component';

const routes: Routes = [
  {path: '', component: ExcelTableComponent},
  {path: 'daten', component: ExcelTableComponent},
  {path: 'info/:id', component: InfopanelComponent}
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {
}
