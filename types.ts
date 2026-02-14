
export interface PrinterConfig {
  headerText: string;
  headerImage: string | null;
  headerImageName: string;
  content: string;
  fontSize: 'sm' | 'base' | 'lg' | 'xl';
  textAlign: 'left' | 'center' | 'right';
  bold: boolean;
  useBluetooth: boolean;
  linkedPrinterName: string | null;
}

export enum ViewMode {
  EDIT = 'edit',
  PREVIEW = 'preview'
}
