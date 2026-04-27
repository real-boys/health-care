export interface DateValidationResult {
  isValid: boolean;
  startDate?: string;
  endDate?: string;
  error?: string;
}

export class dateValidator {
  static validateDateRange(startDate?: string, endDate?: string): DateValidationResult {
    const result: DateValidationResult = {
      isValid: true
    };
    
    // Default to last 30 days if no dates provided
    if (!startDate && !endDate) {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30);
      
      result.startDate = start.toISOString().split('T')[0];
      result.endDate = end.toISOString().split('T')[0];
      return result;
    }
    
    // Validate start date
    if (startDate) {
      const startValidation = this.validateDate(startDate, 'start');
      if (!startValidation.isValid) {
        return startValidation;
      }
      result.startDate = startDate;
    }
    
    // Validate end date
    if (endDate) {
      const endValidation = this.validateDate(endDate, 'end');
      if (!endValidation.isValid) {
        return endValidation;
      }
      result.endDate = endDate;
    }
    
    // If only one date is provided, set the other to create a reasonable range
    if (startDate && !endDate) {
      const start = new Date(startDate);
      const end = new Date(start);
      end.setFullYear(end.getFullYear() + 1); // Default to 1 year from start
      result.endDate = end.toISOString().split('T')[0];
    } else if (!startDate && endDate) {
      const end = new Date(endDate);
      const start = new Date(end);
      start.setFullYear(start.getFullYear() - 1); // Default to 1 year before end
      result.startDate = start.toISOString().split('T')[0];
    }
    
    // Validate date range logic
    if (result.startDate && result.endDate) {
      const start = new Date(result.startDate);
      const end = new Date(result.endDate);
      
      // Check if start is after end
      if (start > end) {
        return {
          isValid: false,
          error: 'Start date cannot be after end date'
        };
      }
      
      // Check if range exceeds 1 year
      const maxRange = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
      if (end.getTime() - start.getTime() > maxRange) {
        return {
          isValid: false,
          error: 'Date range cannot exceed 1 year'
        };
      }
      
      // Check if dates are in the future
      const now = new Date();
      if (start > now) {
        return {
          isValid: false,
          error: 'Start date cannot be in the future'
        };
      }
    }
    
    return result;
  }
  
  private static validateDate(dateString: string, type: 'start' | 'end'): DateValidationResult {
    // Check if date string is in valid format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateString)) {
      return {
        isValid: false,
        error: `${type === 'start' ? 'Start' : 'End'} date must be in YYYY-MM-DD format`
      };
    }
    
    // Check if date is valid
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return {
        isValid: false,
        error: `Invalid ${type === 'start' ? 'start' : 'end'} date`
      };
    }
    
    // Check if the date string matches the parsed date (prevents invalid dates like 2023-02-30)
    const dateParts = dateString.split('-');
    const parsedYear = date.getFullYear();
    const parsedMonth = String(date.getMonth() + 1).padStart(2, '0');
    const parsedDay = String(date.getDate()).padStart(2, '0');
    const reconstructedDate = `${parsedYear}-${parsedMonth}-${parsedDay}`;
    
    if (reconstructedDate !== dateString) {
      return {
        isValid: false,
        error: `Invalid ${type === 'start' ? 'start' : 'end'} date`
      };
    }
    
    return { isValid: true };
  }
  
  static isValidISODate(dateString: string): boolean {
    const result = this.validateDate(dateString, 'start');
    return result.isValid;
  }
  
  static getDateRangePresets(): { [key: string]: { startDate: string; endDate: string; label: string } } {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    // Last 7 days
    const last7Days = new Date(now);
    last7Days.setDate(last7Days.getDate() - 7);
    const last7DaysStr = last7Days.toISOString().split('T')[0];
    
    // Last 30 days
    const last30Days = new Date(now);
    last30Days.setDate(last30Days.getDate() - 30);
    const last30DaysStr = last30Days.toISOString().split('T')[0];
    
    // Last 90 days
    const last90Days = new Date(now);
    last90Days.setDate(last90Days.getDate() - 90);
    const last90DaysStr = last90Days.toISOString().split('T')[0];
    
    // This month
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthStartStr = thisMonthStart.toISOString().split('T')[0];
    
    // Last month
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const lastMonthEndStr = lastMonthEnd.toISOString().split('T')[0];
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthStartStr = lastMonthStart.toISOString().split('T')[0];
    
    // This year
    const thisYearStart = new Date(now.getFullYear(), 0, 1);
    const thisYearStartStr = thisYearStart.toISOString().split('T')[0];
    
    return {
      'last-7-days': {
        startDate: last7DaysStr,
        endDate: today,
        label: 'Last 7 Days'
      },
      'last-30-days': {
        startDate: last30DaysStr,
        endDate: today,
        label: 'Last 30 Days'
      },
      'last-90-days': {
        startDate: last90DaysStr,
        endDate: today,
        label: 'Last 90 Days'
      },
      'this-month': {
        startDate: thisMonthStartStr,
        endDate: today,
        label: 'This Month'
      },
      'last-month': {
        startDate: lastMonthStartStr,
        endDate: lastMonthEndStr,
        label: 'Last Month'
      },
      'this-year': {
        startDate: thisYearStartStr,
        endDate: today,
        label: 'This Year'
      }
    };
  }
}
