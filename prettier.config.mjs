/**
 * @see https://prettier.io/docs/configuration
 * @type {import("prettier").Config}
 */
const prettierConfig = {
  singleQuote: true,
  printWidth: 120,
  bracketSpacing: true,
  trailingComma: 'none',
  arrowParens: 'avoid',
  endOfLine: 'auto',
  importOrder: ['^(react|next?/?([a-zA-Z/]*))$', '<THIRD_PARTY_MODULES>', '^@/(.*)$', '^[./]'],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
  plugins: ['@trivago/prettier-plugin-sort-imports', 'prettier-plugin-tailwindcss']
};

export default prettierConfig;
