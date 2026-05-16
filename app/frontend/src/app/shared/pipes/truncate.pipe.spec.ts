import { TruncatePipe } from './truncate.pipe';

describe('TruncatePipe', () => {
  let pipe: TruncatePipe;

  beforeEach(() => {
    pipe = new TruncatePipe();
  });

  it('should create', () => {
    expect(pipe).toBeTruthy();
  });

  it('should return empty string for empty input', () => {
    expect(pipe.transform('')).toBe('');
  });

  it('should not truncate text shorter than limit', () => {
    expect(pipe.transform('Hello', 10)).toBe('Hello');
  });

  it('should truncate text longer than limit', () => {
    const result = pipe.transform('This is a long text that should be truncated', 20);
    expect(result.length).toBeLessThanOrEqual(23);
    expect(result).toContain('...');
  });

  it('should use default limit of 100', () => {
    const shortText = 'Short';
    expect(pipe.transform(shortText)).toBe(shortText);
  });

  it('should use custom trail', () => {
    const result = pipe.transform('Hello World', 5, '---');
    expect(result).toContain('---');
  });

  it('should handle exact length', () => {
    expect(pipe.transform('Hello', 5)).toBe('Hello');
  });
});
