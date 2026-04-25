# Component Library Documentation

Welcome to the Health-Care Component Library. This library provides reusable, accessible, and themeable UI components.

## Core Principles
1.  **Accessibility First**: Every component must be navigable via keyboard and provide correct ARIA roles/labels.
2.  **Reusable**: Components are designed to be used in various contexts.
3.  **Consistent**: All components follow the design system tokens defined in `DesignSystem.css`.

## Components

### Button
A versatile button component with multiple variants and loading states.
- **Props**:
  - `variant`: `primary`, `secondary`, `outline` (default: `primary`)
  - `size`: `sm`, `md`, `lg` (default: `md`)
  - `isLoading`: `boolean`
  - `disabled`: `boolean`
  - `ariaLabel`: `string`

### Input
A form input field with label, error handling, and helper text.
- **Props**:
  - `label`: `string`
  - `error`: `string`
  - `helperText`: `string`
  - `required`: `boolean`

### Card
A container component for grouping content.
- **Props**:
  - `title`: `string`
  - `footer`: `ReactNode`
  - `elevation`: `sm`, `md`, `lg`

## Theming
The library uses CSS variables. To change the theme, override the variables in `:root` or apply a class like `.dark-theme` to a parent element.
