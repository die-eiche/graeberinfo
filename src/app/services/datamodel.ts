export class DataModel {
  public burialPlotCount: number = 0;
  public grave: string = '';
  public remark: string = '';
  public itemNo: string = '';
  public pricePerYear: number = 0;
  public specialPrice: number = 0;
  public orderNo: number = 0;
  public creditorNo: number = 0;
  public rentalFrom: string = ''; // Date | null = null;
  public occupiedFrom: string = ''; // Date | null = null;
  public rentalUntil: string = ''; // Date | null = null;
  public deceasedName: string = '';
  public dateOfBirth: string = ''; // Date | null = null;
  public dateOfDeath: string = 'tbd...'; // Date | null = null;
}
