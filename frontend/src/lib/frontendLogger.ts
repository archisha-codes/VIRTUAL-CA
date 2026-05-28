/**
 * Frontend Logger Utility for GSTR-1 preparation and filing pipeline observability.
 * Provides styled console logging with distinctive category tags.
 */

const COLORS = {
  UPLOAD: { bg: '#3B82F6', text: '#FFFFFF' },      // Blue
  CLASSIFICATION: { bg: '#8B5CF6', text: '#FFFFFF' }, // Purple
  VALIDATION: { bg: '#F59E0B', text: '#FFFFFF' },     // Amber
  SUMMARY: { bg: '#10B981', text: '#FFFFFF' },        // Green
  API: { bg: '#EF4444', text: '#FFFFFF' },            // Red
  STORE: { bg: '#EC4899', text: '#FFFFFF' },          // Pink
};

type LogCategory = keyof typeof COLORS;

class FrontendLogger {
  private formatTag(moduleName: string): { prefix: string; style: string } {
    const category = moduleName.toUpperCase() as LogCategory;
    const color = COLORS[category] || { bg: '#6B7280', text: '#FFFFFF' };
    return {
      prefix: `%c[GSTR1:${category}]`,
      style: `background: ${color.bg}; color: ${color.text}; padding: 2px 6px; border-radius: 4px; font-weight: bold;`
    };
  }

  log(moduleName: string, message: string, ...args: any[]) {
    const { prefix, style } = this.formatTag(moduleName);
    console.log(prefix, style, message, ...args);
  }

  warn(moduleName: string, message: string, ...args: any[]) {
    const { prefix, style } = this.formatTag(moduleName);
    console.warn(prefix, style, message, ...args);
  }

  error(moduleName: string, message: string, ...args: any[]) {
    const { prefix, style } = this.formatTag(moduleName);
    console.error(prefix, style, message, ...args);
  }
}

export const logger = new FrontendLogger();
