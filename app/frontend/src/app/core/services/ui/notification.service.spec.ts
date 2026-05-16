import { TestBed } from '@angular/core/testing';
import { ToastrModule, ToastrService } from 'ngx-toastr';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let toastrSpy: jasmine.SpyObj<ToastrService>;

  beforeEach(() => {
    toastrSpy = jasmine.createSpyObj('ToastrService', ['success', 'error', 'warning', 'info']);

    TestBed.configureTestingModule({
      imports: [ToastrModule.forRoot()],
      providers: [
        NotificationService,
        { provide: ToastrService, useValue: toastrSpy }
      ]
    });
    service = TestBed.inject(NotificationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should call toastr.success with correct arguments', () => {
    service.success('Item added', 'Cart');
    expect(toastrSpy.success).toHaveBeenCalledWith('Item added', 'Cart');
  });

  it('should call toastr.error with correct arguments', () => {
    service.error('Something went wrong', 'Error');
    expect(toastrSpy.error).toHaveBeenCalledWith('Something went wrong', 'Error', jasmine.any(Object));
  });

  it('should call toastr.warning with correct arguments', () => {
    service.warning('Low stock', 'Warning');
    expect(toastrSpy.warning).toHaveBeenCalledWith('Low stock', 'Warning', jasmine.any(Object));
  });

  it('should call toastr.info with correct arguments', () => {
    service.info('Cart updated', 'Info');
    expect(toastrSpy.info).toHaveBeenCalledWith('Cart updated', 'Info');
  });

  it('should use default title for success', () => {
    service.success('Done');
    expect(toastrSpy.success).toHaveBeenCalledWith('Done', 'Success');
  });

  it('should use default title for error', () => {
    service.error('Failed');
    expect(toastrSpy.error).toHaveBeenCalledWith('Failed', 'Error', jasmine.any(Object));
  });
});
