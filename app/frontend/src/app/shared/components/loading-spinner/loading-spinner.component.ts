import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-loading-spinner',
  templateUrl: './loading-spinner.component.html',
  styleUrl: './loading-spinner.component.scss'
})
export class LoadingSpinnerComponent {
  /** Optional loading message shown below/beside the spinner */
  @Input() message?: string;

  /** Spinner size: small (18px), medium (40px), large (56px) */
  @Input() size: 'small' | 'medium' | 'large' = 'medium';

  /** Layout: block = centered column, inline = compact row */
  @Input() layout: 'block' | 'inline' = 'block';

  /** Variant: default = primary color, light = white (for dark backgrounds like buttons) */
  @Input() variant: 'default' | 'light' = 'default';
}
