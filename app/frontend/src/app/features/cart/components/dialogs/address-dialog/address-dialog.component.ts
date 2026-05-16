import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import { AddressDialogMode, AddressEntry, AddressForm } from '../../../models/address.model';
import { NotificationService } from '../../../../../core/services/ui/notification.service';
import { AddressApiService } from '../../../services/address-api.service';
import { ConfirmDialogService } from '../../../../../core/services/ui/confirm-dialog.service';

@Component({
  selector: 'app-address-dialog',
  templateUrl: './address-dialog.component.html',
  styleUrl: './address-dialog.component.scss'
})
export class AddressDialogComponent implements OnInit, OnChanges, OnDestroy {
  @Input() selectedAddressId: number | null = null;

  @Output() selectedAddressIdChange = new EventEmitter<number | null>();
  @Output() addressesChange = new EventEmitter<AddressEntry[]>();
  @Output() closed = new EventEmitter<void>();

  addresses: AddressEntry[] = [];
  isLoadingAddresses = false;
  isSaving = false;
  isDeleting = false;

  dialogMode: AddressDialogMode = 'list';
  editingAddressId: number | null = null;
  addressForm: AddressForm = this.blankForm();
  formSubmitted = false;
  closing = false;

  localSelectedId: number | null = null;

  constructor(
    private elementRef: ElementRef<HTMLElement>,
    private notificationService: NotificationService,
    private addressApi: AddressApiService,
    private confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    document.body.appendChild(this.elementRef.nativeElement);
    this.loadAddresses();
  }

  ngOnDestroy(): void {
    const el = this.elementRef.nativeElement;
    if (el.parentNode) {
      el.parentNode.removeChild(el);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedAddressId']) {
      this.localSelectedId = this.selectedAddressId;
    }
    this.dialogMode = 'list';
    this.editingAddressId = null;
    this.addressForm = this.blankForm();
    this.formSubmitted = false;
  }

  private loadAddresses(emitChange = false): void {
    this.isLoadingAddresses = true;
    this.addressApi.getAddresses().subscribe({
      next: (list) => {
        this.addresses = list;
        this.isLoadingAddresses = false;
        if (!this.localSelectedId && list.length > 0) {
          const def = list.find(a => a.isDefault) ?? list[0];
          this.localSelectedId = def.id;
        }
        if (emitChange) {
          this.addressesChange.emit(list);
        }
      },
      error: () => {
        this.isLoadingAddresses = false;
        this.notificationService.error('Failed to load addresses.');
      },
    });
  }

  openAddMode(): void {
    this.formSubmitted = false;
    this.addressForm = this.blankForm();
    this.editingAddressId = null;
    this.dialogMode = 'add';
  }

  openEditMode(address: AddressEntry, event: Event): void {
    event.preventDefault();
    this.formSubmitted = false;
    this.editingAddressId = address.id;
    this.addressForm = {
      fullName: address.fullName,
      phone: address.phone ?? '',
      address: address.address,
      city: address.city,
      isDefault: address.isDefault,
      label: address.label,
    };
    this.dialogMode = 'edit';
  }

  backToList(): void {
    this.formSubmitted = false;
    this.editingAddressId = null;
    this.addressForm = this.blankForm();
    this.dialogMode = 'list';
  }

  close(): void {
    if (this.closing) return;
    this.closing = true;
  }

  onOverlayAnimationDone(event: AnimationEvent): void {
    if (this.closing && event.target === event.currentTarget) {
      this.closed.emit();
    }
  }

  confirmSelection(): void {
    this.selectedAddressIdChange.emit(this.localSelectedId);
    this.close();
  }

  onRadioChange(id: number): void {
    this.localSelectedId = id;
  }

  setLabel(label: 'home' | 'work' | 'other'): void {
    this.addressForm.label = label;
  }

  promptDelete(address: AddressEntry, event: Event): void {
    event.preventDefault();
    if (this.addresses.length <= 1) {
      this.notificationService.error('You must keep at least one address.');
      return;
    }
    this.confirmDialog.confirm({
      title: 'Delete Address',
      message: `Remove "${address.fullName} — ${address.address}, ${address.city}"? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      danger: true,
    }).subscribe(confirmed => {
      if (!confirmed) return;
      this.isDeleting = true;
      this.addressApi.deleteAddress(address.id).subscribe({
        next: () => {
          this.isDeleting = false;
          if (this.localSelectedId === address.id) {
            const remaining = this.addresses.filter(a => a.id !== address.id);
            const fallback = remaining.find(a => a.isDefault) ?? remaining[0];
            this.localSelectedId = fallback?.id ?? null;
          }
          this.notificationService.info('Address removed.');
          this.loadAddresses(true);
        },
        error: () => {
          this.isDeleting = false;
          this.notificationService.error('Failed to delete address. Please try again.');
        },
      });
    });
  }

  saveAddress(): void {
    this.formSubmitted = true;
    if (
      !this.addressForm.fullName.trim() ||
      !this.addressForm.address.trim() ||
      !this.addressForm.city.trim()
    ) {
      return;
    }

    this.isSaving = true;

    if (this.dialogMode === 'edit' && this.editingAddressId !== null) {
      this.addressApi.updateAddress(this.editingAddressId, this.addressForm).subscribe({
        next: (updated) => {
          this.isSaving = false;
          const idx = this.addresses.findIndex(a => a.id === this.editingAddressId);
          if (idx !== -1) this.addresses[idx] = updated;
          this.notificationService.success('Address updated!');
          this.backToList();
          this.loadAddresses(true);
        },
        error: () => {
          this.isSaving = false;
          this.notificationService.error('Failed to update address. Please try again.');
        },
      });
    } else {
      this.addressApi.createAddress(this.addressForm).subscribe({
        next: (created) => {
          this.isSaving = false;
          this.localSelectedId = created.id;
          this.notificationService.success('New address added!');
          this.backToList();
          this.loadAddresses(true);
        },
        error: () => {
          this.isSaving = false;
          this.notificationService.error('Failed to save address. Please try again.');
        },
      });
    }
  }

  private blankForm(): AddressForm {
    return { fullName: '', phone: '', address: '', city: '', isDefault: false, label: 'home' };
  }
}
