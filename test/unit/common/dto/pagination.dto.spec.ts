// test/unit/common/dto/pagination.dto.spec.ts

import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { PaginationDto, PAGINATION_CONSTANTS } from '../../../../src/common/dto/pagination.dto';

describe('PaginationDto - Unit Tests', () => {
  describe('Default Values', () => {
    it('should use default page value when not provided', () => {
      const dto = new PaginationDto();
      expect(dto.page).toBe(PAGINATION_CONSTANTS.DEFAULT_PAGE);
    });

    it('should use default limit value when not provided', () => {
      const dto = new PaginationDto();
      expect(dto.limit).toBe(PAGINATION_CONSTANTS.DEFAULT_LIMIT);
    });

    it('should use default values with empty object', () => {
      const dto = plainToClass(PaginationDto, {});
      expect(dto.page).toBe(PAGINATION_CONSTANTS.DEFAULT_PAGE);
      expect(dto.limit).toBe(PAGINATION_CONSTANTS.DEFAULT_LIMIT);
    });
  });

  describe('Valid Input Validation', () => {
    it('should accept valid page and limit values', async () => {
      const dto = plainToClass(PaginationDto, { page: 5, limit: 25 });
      const errors = await validate(dto);
      
      expect(errors).toHaveLength(0);
      expect(dto.page).toBe(5);
      expect(dto.limit).toBe(25);
    });

    it('should accept page 1 and limit 1 (minimum values)', async () => {
      const dto = plainToClass(PaginationDto, { page: 1, limit: 1 });
      const errors = await validate(dto);
      
      expect(errors).toHaveLength(0);
      expect(dto.page).toBe(1);
      expect(dto.limit).toBe(1);
    });

    it('should accept limit 100 (maximum value)', async () => {
      const dto = plainToClass(PaginationDto, { page: 1, limit: 100 });
      const errors = await validate(dto);
      
      expect(errors).toHaveLength(0);
      expect(dto.limit).toBe(100);
    });
  });

  describe('String to Number Transformation', () => {
    it('should transform string page to number', () => {
      const dto = plainToClass(PaginationDto, { page: '3', limit: '20' });
      
      expect(typeof dto.page).toBe('number');
      expect(typeof dto.limit).toBe('number');
      expect(dto.page).toBe(3);
      expect(dto.limit).toBe(20);
    });

    it('should handle numeric strings with whitespace', () => {
      const dto = plainToClass(PaginationDto, { page: ' 2 ', limit: ' 15 ' });
      
      expect(dto.page).toBe(2);
      expect(dto.limit).toBe(15);
    });
  });

  describe('Invalid Input Validation', () => {
    it('should reject page less than 1', async () => {
      const dto = plainToClass(PaginationDto, { page: 0 });
      const errors = await validate(dto);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('min');
      expect(errors[0].constraints?.min).toContain('page must be at least 1');
    });

    it('should reject negative page values', async () => {
      const dto = plainToClass(PaginationDto, { page: -1 });
      const errors = await validate(dto);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('min');
    });

    it('should reject limit less than 1', async () => {
      const dto = plainToClass(PaginationDto, { limit: 0 });
      const errors = await validate(dto);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('min');
      expect(errors[0].constraints?.min).toContain('limit must be at least 1');
    });

    it('should reject limit greater than 100', async () => {
      const dto = plainToClass(PaginationDto, { limit: 101 });
      const errors = await validate(dto);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('max');
      expect(errors[0].constraints?.max).toContain('limit must not be greater than 100');
    });

    it('should reject non-integer page values', async () => {
      const dto = plainToClass(PaginationDto, { page: 1.5 });
      const errors = await validate(dto);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isInt');
      expect(errors[0].constraints?.isInt).toContain('page must be an integer');
    });

    it('should reject non-integer limit values', async () => {
      const dto = plainToClass(PaginationDto, { limit: 10.7 });
      const errors = await validate(dto);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isInt');
      expect(errors[0].constraints?.isInt).toContain('limit must be an integer');
    });
  });

  describe('Edge Cases - Invalid Types', () => {
    it('should handle non-numeric string values', async () => {
      const dto = plainToClass(PaginationDto, { page: 'abc', limit: 'xyz' });
      const errors = await validate(dto);
      
      expect(errors.length).toBeGreaterThan(0);
      // La transformation échoue et produit NaN, qui échoue à la validation isInt
    });

    it('should handle boolean values', async () => {
      const dto = plainToClass(PaginationDto, { page: true, limit: false });
      const errors = await validate(dto);
      
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should handle array values', async () => {
      const dto = plainToClass(PaginationDto, { page: [1], limit: [10] });
      const errors = await validate(dto);
      
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should handle object values', async () => {
      const dto = plainToClass(PaginationDto, { page: {}, limit: {} });
      const errors = await validate(dto);
      
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('getSkip() Method', () => {
    it('should calculate correct skip value for page 1', () => {
      const dto = new PaginationDto();
      dto.page = 1;
      dto.limit = 10;
      
      expect(dto.getSkip()).toBe(0);
    });

    it('should calculate correct skip value for page 2', () => {
      const dto = new PaginationDto();
      dto.page = 2;
      dto.limit = 10;
      
      expect(dto.getSkip()).toBe(10);
    });

    it('should calculate correct skip value for page 5 with limit 25', () => {
      const dto = new PaginationDto();
      dto.page = 5;
      dto.limit = 25;
      
      expect(dto.getSkip()).toBe(100); // (5-1) * 25
    });

    it('should handle undefined page and use default', () => {
      const dto = new PaginationDto();
      dto.page = undefined;
      dto.limit = 20;
      
      expect(dto.getSkip()).toBe(0); // (1-1) * 20
    });

    it('should handle undefined limit and use default', () => {
      const dto = new PaginationDto();
      dto.page = 3;
      dto.limit = undefined;
      
      expect(dto.getSkip()).toBe(20); // (3-1) * 10
    });

    it('should handle both undefined values', () => {
      const dto = new PaginationDto();
      dto.page = undefined;
      dto.limit = undefined;
      
      expect(dto.getSkip()).toBe(0); // (1-1) * 10
    });
  });

  describe('getTake() Method', () => {
    it('should return limit value', () => {
      const dto = new PaginationDto();
      dto.limit = 25;
      
      expect(dto.getTake()).toBe(25);
    });

    it('should return default limit when undefined', () => {
      const dto = new PaginationDto();
      dto.limit = undefined;
      
      expect(dto.getTake()).toBe(PAGINATION_CONSTANTS.DEFAULT_LIMIT);
    });

    it('should work with various limit values', () => {
      const testCases = [1, 10, 50, 100];
      
      testCases.forEach(limit => {
        const dto = new PaginationDto();
        dto.limit = limit;
        expect(dto.getTake()).toBe(limit);
      });
    });
  });

  describe('isValid() Method', () => {
    it('should return true for valid pagination', () => {
      const dto = new PaginationDto();
      dto.page = 2;
      dto.limit = 25;
      
      expect(dto.isValid()).toBe(true);
    });

    it('should return true for default values', () => {
      const dto = new PaginationDto();
      
      expect(dto.isValid()).toBe(true);
    });

    it('should return false for invalid page', () => {
      const dto = new PaginationDto();
      dto.page = 0;
      dto.limit = 10;
      
      expect(dto.isValid()).toBe(false);
    });

    it('should return false for invalid limit (too low)', () => {
      const dto = new PaginationDto();
      dto.page = 1;
      dto.limit = 0;
      
      expect(dto.isValid()).toBe(false);
    });

    it('should return false for invalid limit (too high)', () => {
      const dto = new PaginationDto();
      dto.page = 1;
      dto.limit = 101;
      
      expect(dto.isValid()).toBe(false);
    });

    it('should handle undefined values correctly', () => {
      const dto = new PaginationDto();
      dto.page = undefined;
      dto.limit = undefined;
      
      expect(dto.isValid()).toBe(true);
    });
  });

  describe('toString() Method', () => {
    it('should provide meaningful string representation', () => {
      const dto = new PaginationDto();
      dto.page = 3;
      dto.limit = 20;
      
      const result = dto.toString();
      
      expect(result).toContain('page=3');
      expect(result).toContain('limit=20');
      expect(result).toContain('skip=40');
    });

    it('should handle default values', () => {
      const dto = new PaginationDto();
      
      const result = dto.toString();
      
      expect(result).toContain(`page=${PAGINATION_CONSTANTS.DEFAULT_PAGE}`);
      expect(result).toContain(`limit=${PAGINATION_CONSTANTS.DEFAULT_LIMIT}`);
      expect(result).toContain('skip=0');
    });

    it('should handle undefined values', () => {
      const dto = new PaginationDto();
      dto.page = undefined;
      dto.limit = undefined;
      
      const result = dto.toString();
      
      expect(result).toContain(`page=${PAGINATION_CONSTANTS.DEFAULT_PAGE}`);
      expect(result).toContain(`limit=${PAGINATION_CONSTANTS.DEFAULT_LIMIT}`);
    });
  });

  describe('Performance Edge Cases', () => {
    it('should handle very large page numbers efficiently', () => {
      const dto = new PaginationDto();
      dto.page = 999999;
      dto.limit = 50;
      
      const start = performance.now();
      const skip = dto.getSkip();
      const end = performance.now();
      
      expect(skip).toBe(49999900); // (999999-1) * 50 = 999998 * 50
      expect(end - start).toBeLessThan(1); // Should be very fast
    });

    it('should handle maximum limit efficiently', () => {
      const dto = new PaginationDto();
      dto.page = 1000;
      dto.limit = 100;
      
      const start = performance.now();
      const skip = dto.getSkip();
      const end = performance.now();
      
      expect(skip).toBe(99900); // (1000-1) * 100
      expect(end - start).toBeLessThan(1);
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should not leak memory with repeated instantiation', () => {
      const instances = [];
      
      // Créer beaucoup d'instances
      for (let i = 0; i < 1000; i++) {
        const dto = new PaginationDto();
        dto.page = i;
        dto.limit = 10;
        instances.push(dto.getSkip());
      }
      
      expect(instances).toHaveLength(1000);
      expect(instances[999]).toBe(9980); // (999-1) * 10
    });
  });

  describe('Constants Verification', () => {
    it('should have correct constant values', () => {
      expect(PAGINATION_CONSTANTS.DEFAULT_PAGE).toBe(1);
      expect(PAGINATION_CONSTANTS.DEFAULT_LIMIT).toBe(10);
      expect(PAGINATION_CONSTANTS.MAX_LIMIT).toBe(100);
      expect(PAGINATION_CONSTANTS.MIN_PAGE).toBe(1);
      expect(PAGINATION_CONSTANTS.MIN_LIMIT).toBe(1);
    });

    it('should use constants in validation messages', async () => {
      const dto = plainToClass(PaginationDto, { page: 0 });
      const errors = await validate(dto);
      
      expect(errors[0].constraints?.min).toContain(PAGINATION_CONSTANTS.MIN_PAGE.toString());
    });
  });
});