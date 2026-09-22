import { HumanizePipe } from './humanize.pipe';

describe('HumanizePipe', () => {
  let pipe: HumanizePipe;

  beforeEach(() => {
    pipe = new HumanizePipe();
  });

  it('should turn an event code into words', () => {
    expect(pipe.transform('cart.item_added')).toBe('Cart item added');
    expect(pipe.transform('admin.user_role_changed')).toBe('Admin user role changed');
  });

  it('should keep a type in capitals, with spaces for underscores', () => {
    expect(pipe.transform('LOGIN_FAILED')).toBe('LOGIN FAILED');
    expect(pipe.transform('READ')).toBe('READ');
  });

  it('should return an empty string for no value', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform('')).toBe('');
  });
});
